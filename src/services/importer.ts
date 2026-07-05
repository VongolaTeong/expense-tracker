/**
 * CSV import orchestration: parse → plan (pure) → apply via repositories.
 * Idempotent by design — rows are matched by id (update) or inserted, unknown
 * category names are auto-created, and nothing is ever deleted.
 */

import { addCategory, listCategories } from '../db/categories';
import { bulkUpsertExpenses, listExpenseIds } from '../db/expenses';
import { parseCsv } from './csv';
import { normalizeCategoryName, planImport } from './importPlan';

export interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
}

/** Throws on an unrecognizable file (bad header); bad rows just count as skipped. */
export async function importCsv(content: string): Promise<ImportSummary> {
  const { validRows, skippedCount } = parseCsv(content);
  const categories = await listCategories();
  const existingIds = new Set(await listExpenseIds());
  const plan = planImport(validRows, categories, existingIds);

  const idByName = new Map(
    categories.map((c) => [normalizeCategoryName(c.name), c.id])
  );
  for (const name of plan.newCategoryNames) {
    const created = await addCategory(name);
    idByName.set(normalizeCategoryName(created.name), created.id);
  }

  const items = plan.upserts.map((upsert) => {
    const categoryId = idByName.get(normalizeCategoryName(upsert.categoryName));
    if (categoryId === undefined) {
      // planImport guarantees every category is known or newly created
      throw new Error(`Category "${upsert.categoryName}" was not created`);
    }
    return {
      id: upsert.id,
      categoryId,
      note: upsert.note,
      amountCents: upsert.amountCents,
      spentOn: upsert.spentOn,
    };
  });

  const { inserted, updated } = await bulkUpsertExpenses(items);
  return { imported: inserted, updated, skipped: skippedCount };
}
