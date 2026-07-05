/**
 * CSV serialize/parse — the canonical interchange format. Pure — no Expo
 * imports; this module is shared verbatim by manual export, monthly backup,
 * and import (one code path).
 *
 * Format (see CLAUDE.md): header `id,date,category,note,amount`, RFC 4180
 * quoting, LF record separators on export (CRLF/LF both tolerated on parse),
 * amounts as decimal strings with ≤2 decimals, category by name.
 */

import { isValidIsoDate } from '../domain/dates';
import { formatAmount, parseAmountInput } from '../domain/money';
import type { Category, Expense } from '../domain/types';

export const CSV_HEADER = 'id,date,category,note,amount';

/** One validated data row; the importer (Phase 8) maps these into the DB. */
export interface CsvExpenseRow {
  id: string;
  /** YYYY-MM-DD, calendar-validated. */
  date: string;
  /** Category name — raw as found in the file. */
  category: string;
  note: string;
  amountCents: number;
}

export interface ParsedCsv {
  validRows: CsvExpenseRow[];
  /** Structurally or semantically invalid data rows (blank lines excluded). */
  skippedCount: number;
}

/**
 * Full export. Rows are canonically ordered (date, then id) so the same data
 * always serializes to the same bytes, regardless of DB iteration order —
 * this is what makes the round-trip test meaningful.
 * Throws if an expense references a category not in `categories`.
 */
export function exportToCsv(expenses: Expense[], categories: Category[]): string {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const sorted = [...expenses].sort((a, b) =>
    a.spentOn !== b.spentOn
      ? a.spentOn < b.spentOn
        ? -1
        : 1
      : a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0
  );
  const lines = [CSV_HEADER];
  for (const expense of sorted) {
    const name = nameById.get(expense.categoryId);
    if (name === undefined) {
      throw new Error(
        `Expense ${expense.id} references unknown category ${expense.categoryId}`
      );
    }
    const fields = [
      expense.id,
      expense.spentOn,
      name,
      expense.note,
      formatAmount(expense.amountCents),
    ];
    lines.push(fields.map(serializeField).join(','));
  }
  return lines.join('\n') + '\n';
}

/**
 * Parses CSV text. Throws if the header row is missing or wrong (the file is
 * not ours); individual bad rows (wrong field count, empty id, bad date,
 * empty category, non-positive or malformed amount) are skipped and counted.
 * Blank lines are ignored without counting. Duplicate ids are NOT collapsed
 * here — the importer's upsert makes last-one-wins idempotent.
 */
export function parseCsv(content: string): ParsedCsv {
  const { records, unterminatedQuote } = parseRecords(content);
  let skippedCount = 0;
  let working = records;
  if (unterminatedQuote && working.length > 0) {
    // The final record swallowed the rest of the file after an unclosed
    // quote; it is unusable.
    working = working.slice(0, -1);
    skippedCount += 1;
  }
  const nonEmpty = working.filter((r) => !(r.length === 1 && r[0] === ''));
  const header = nonEmpty[0];
  if (!header || header.join(',') !== CSV_HEADER) {
    throw new Error(`Unrecognized CSV header — expected "${CSV_HEADER}"`);
  }

  const validRows: CsvExpenseRow[] = [];
  for (const record of nonEmpty.slice(1)) {
    const row = toRow(record);
    if (row) {
      validRows.push(row);
    } else {
      skippedCount += 1;
    }
  }
  return { validRows, skippedCount };
}

function toRow(record: string[]): CsvExpenseRow | null {
  if (record.length !== 5) return null;
  const [id, date, category, note, amount] = record;
  if (id === '') return null;
  if (!isValidIsoDate(date)) return null;
  if (category.trim() === '') return null;
  const parsed = parseAmountInput(amount);
  // Zero/negative amounts can't exist in the app (save requires > 0).
  if (!parsed.ok || parsed.cents <= 0) return null;
  return { id, date, category, note, amountCents: parsed.cents };
}

// ── RFC 4180 primitives ──────────────────────────────────────────────────────

function serializeField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Splits text into records/fields. Quoted fields may contain commas, doubled
 * quotes, and newlines (preserved byte-for-byte). Record separators outside
 * quotes: CRLF, LF, or lone CR. Lenient with stray quotes mid-field (kept
 * literal) — validation happens per-row, not here.
 */
function parseRecords(content: string): {
  records: string[][];
  unterminatedQuote: boolean;
} {
  const records: string[][] = [];
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
    } else if (ch === '"' && field === '') {
      inQuotes = true;
      i += 1;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      i += ch === '\r' && content[i + 1] === '\n' ? 2 : 1;
      fields.push(field);
      records.push(fields);
      field = '';
      fields = [];
    } else {
      field += ch;
      i += 1;
    }
  }

  if (inQuotes || field !== '' || fields.length > 0) {
    fields.push(field);
    records.push(fields);
  }
  return { records, unterminatedQuote: inQuotes };
}
