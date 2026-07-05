/**
 * DEV-ONLY helpers behind the __DEV__ flag in Settings. Used for the
 * performance sanity check (~5,000 rows) — not part of the product.
 */

import { addDays, todayIso } from '../domain/dates';
import { listCategories } from './categories';
import { getDatabase, newId, nowIso } from './database';
import { notifyDataChanged } from './notifier';

const SAMPLE_NOTES = [
  'coffee',
  'lunch',
  'groceries run',
  'taxi',
  'movie night',
  '',
  '',
  '',
  'snack',
  'pharmacy',
  'gift',
  'parking',
];

/** Inserts `count` random expenses spread over the past ~2 years. */
export async function seedTestExpenses(count: number): Promise<void> {
  const categories = await listCategories();
  if (categories.length === 0) throw new Error('No categories to seed into');
  const db = await getDatabase();
  const today = todayIso();
  const createdAt = nowIso();

  await db.withExclusiveTransactionAsync(async (txn) => {
    const stmt = await txn.prepareAsync(
      `INSERT INTO expenses (id, category_id, note, amount_cents, spent_on, created_at)
       VALUES ($id, $categoryId, $note, $amountCents, $spentOn, $createdAt)`
    );
    try {
      for (let i = 0; i < count; i += 1) {
        await stmt.executeAsync({
          $id: newId(),
          $categoryId: categories[i % categories.length].id,
          $note: SAMPLE_NOTES[Math.floor(Math.random() * SAMPLE_NOTES.length)],
          $amountCents: 50 + Math.floor(Math.random() * 30000),
          $spentOn: addDays(today, -Math.floor(Math.random() * 730)),
          $createdAt: createdAt,
        });
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });
  notifyDataChanged();
}

/** Removes every expense (categories stay). */
export async function deleteAllExpenses(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM expenses');
  notifyDataChanged();
}
