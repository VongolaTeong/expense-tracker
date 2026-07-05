/**
 * Pure import planning — no Expo/DB imports, unit-tested in Node.
 * Decides what an import will do; services/importer.ts applies the plan
 * against the repositories.
 */

import type { CsvExpenseRow } from './csv';
import type { Category } from '../domain/types';

export interface PlannedUpsert {
  id: string;
  /** Trimmed category name; resolved to an id at apply time. */
  categoryName: string;
  note: string;
  amountCents: number;
  spentOn: string;
  /** True when the expense id already exists (update rather than insert). */
  exists: boolean;
}

export interface ImportPlan {
  /**
   * Category names to create, trimmed, in first-appearance order (they get
   * appended to the end of the sort order). Case-insensitively absent from
   * the existing categories and deduped within the file.
   */
  newCategoryNames: string[];
  /** One upsert per unique expense id — the file's last occurrence wins. */
  upserts: PlannedUpsert[];
}

/** Case-insensitive matching key; category names are unique case-insensitively. */
export function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase();
}

export function planImport(
  rows: CsvExpenseRow[],
  categories: Category[],
  existingExpenseIds: ReadonlySet<string>
): ImportPlan {
  const knownNames = new Set(categories.map((c) => normalizeCategoryName(c.name)));
  const newCategoryNames: string[] = [];
  const upsertsById = new Map<string, PlannedUpsert>();

  for (const row of rows) {
    const categoryName = row.category.trim();
    const key = normalizeCategoryName(categoryName);
    if (!knownNames.has(key)) {
      knownNames.add(key);
      newCategoryNames.push(categoryName);
    }
    // Map.set overwrites: the last occurrence of an id wins, matching the
    // sequential-upsert semantics of applying the file top to bottom.
    upsertsById.set(row.id, {
      id: row.id,
      categoryName,
      note: row.note,
      amountCents: row.amountCents,
      spentOn: row.date,
      exists: existingExpenseIds.has(row.id),
    });
  }

  return { newCategoryNames, upserts: [...upsertsById.values()] };
}
