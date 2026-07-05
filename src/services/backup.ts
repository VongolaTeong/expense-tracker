/**
 * CSV export targets: manual share-sheet export and the lazy monthly backup.
 * Both go through buildExportCsv → services/csv.exportToCsv, so backup files
 * and manual exports are byte-compatible (one serializer code path).
 */

import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { listCategories } from '../db/categories';
import { getAllExpenses } from '../db/expenses';
import { getSetting, setSetting } from '../db/settings';
import { monthKeyOf, todayIso } from '../domain/dates';
import { exportToCsv } from './csv';

const LAST_BACKUP_MONTH = 'last_backup_month';

export async function buildExportCsv(): Promise<string> {
  const [expenses, categories] = await Promise.all([getAllExpenses(), listCategories()]);
  return exportToCsv(expenses, categories);
}

function writeTextFile(file: File, content: string): void {
  if (file.exists) file.delete();
  file.create();
  file.write(content);
}

/** Manual export: full CSV to a cache file, then the OS share sheet. */
export async function exportAndShare(): Promise<void> {
  const csv = await buildExportCsv();
  const file = new File(Paths.cache, `expenses-${todayIso()}.csv`);
  writeTextFile(file, csv);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export expenses',
  });
}

function backupsDirectory(): Directory {
  return new Directory(Paths.document, 'backups');
}

/**
 * Lazy monthly backup (no background tasks in v1): when the current month
 * differs from settings.last_backup_month, snapshot everything to
 * backups/backup-YYYY-MM.csv and record the month. Runs on every app launch
 * and foreground resume; returns true when a backup was written.
 */
export async function maybeRunMonthlyBackup(): Promise<boolean> {
  const currentMonth = monthKeyOf(todayIso());
  const last = await getSetting(LAST_BACKUP_MONTH);
  if (last === currentMonth) return false;

  const csv = await buildExportCsv();
  const dir = backupsDirectory();
  if (!dir.exists) dir.create();
  writeTextFile(new File(dir, `backup-${currentMonth}.csv`), csv);
  await setSetting(LAST_BACKUP_MONTH, currentMonth);
  return true;
}

export interface BackupFileInfo {
  name: string;
  uri: string;
  /** Bytes; null when the platform can't report it. */
  size: number | null;
}

/** All kept backup files, newest first (names sort chronologically). */
export function listBackups(): BackupFileInfo[] {
  const dir = backupsDirectory();
  if (!dir.exists) return [];
  return dir
    .list()
    .filter((entry): entry is File => entry instanceof File && entry.name.endsWith('.csv'))
    .sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0))
    .map((file) => ({ name: file.name, uri: file.uri, size: file.size ?? null }));
}

export async function shareBackup(uri: string): Promise<void> {
  await Sharing.shareAsync(uri, { mimeType: 'text/csv' });
}

export function deleteBackup(uri: string): void {
  const file = new File(uri);
  if (file.exists) file.delete();
}
