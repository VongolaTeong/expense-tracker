import type { Category } from '../domain/types';
import { getDatabase, newId, nowIso } from './database';

interface CategoryRow {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function listCategories(): Promise<Category[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT id, name, sort_order, created_at FROM categories ORDER BY sort_order'
  );
  return rows.map(toCategory);
}

/**
 * Adds a category at the end of the sort order.
 * Throws if the name is empty/whitespace or already taken (case-insensitive).
 */
export async function addCategory(name: string): Promise<Category> {
  const trimmed = name.trim();
  if (trimmed === '') throw new Error('Category name cannot be empty');
  const db = await getDatabase();
  if (await nameTaken(trimmed)) {
    throw new Error(`Category "${trimmed}" already exists`);
  }
  const maxRow = await db.getFirstAsync<{ max_order: number | null }>(
    'SELECT MAX(sort_order) AS max_order FROM categories'
  );
  const sortOrder = maxRow?.max_order != null ? maxRow.max_order + 1 : 0;
  const category: Category = {
    id: newId(),
    name: trimmed,
    sortOrder,
    createdAt: nowIso(),
  };
  await db.runAsync(
    'INSERT INTO categories (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)',
    [category.id, category.name, category.sortOrder, category.createdAt]
  );
  return category;
}

/** Renaming is allowed anytime; same validation as addCategory. */
export async function renameCategory(id: string, newName: string): Promise<void> {
  const trimmed = newName.trim();
  if (trimmed === '') throw new Error('Category name cannot be empty');
  const db = await getDatabase();
  if (await nameTaken(trimmed, id)) {
    throw new Error(`Category "${trimmed}" already exists`);
  }
  await db.runAsync('UPDATE categories SET name = ? WHERE id = ?', [trimmed, id]);
}

/** Rewrites sort_order to match the given full list of category ids. */
export async function reorderCategories(orderedIds: string[]): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await txn.runAsync('UPDATE categories SET sort_order = ? WHERE id = ?', [
        i,
        orderedIds[i],
      ]);
    }
  });
}

export async function categoryHasExpenses(id: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ found: number }>(
    'SELECT 1 AS found FROM expenses WHERE category_id = ? LIMIT 1',
    [id]
  );
  return row !== null;
}

/** Deletion is only allowed for unused categories (no orphan/reassignment). */
export async function deleteCategory(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync<{ found: number }>(
      'SELECT 1 AS found FROM expenses WHERE category_id = ? LIMIT 1',
      [id]
    );
    if (row !== null) {
      throw new Error('Cannot delete a category that has expenses');
    }
    await txn.runAsync('DELETE FROM categories WHERE id = ?', [id]);
  });
}

async function nameTaken(name: string, excludeId?: string): Promise<boolean> {
  const db = await getDatabase();
  const row = excludeId
    ? await db.getFirstAsync<{ found: number }>(
        'SELECT 1 AS found FROM categories WHERE lower(name) = lower(?) AND id <> ? LIMIT 1',
        [name, excludeId]
      )
    : await db.getFirstAsync<{ found: number }>(
        'SELECT 1 AS found FROM categories WHERE lower(name) = lower(?) LIMIT 1',
        [name]
      );
  return row !== null;
}
