import type { CategorySummary, Expense, ExpenseInput } from '../domain/types';
import { getDatabase, newId, nowIso } from './database';
import { notifyDataChanged } from './notifier';

interface ExpenseRow {
  id: string;
  category_id: string;
  note: string;
  amount_cents: number;
  spent_on: string;
  created_at: string;
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    categoryId: row.category_id,
    note: row.note,
    amountCents: row.amount_cents,
    spentOn: row.spent_on,
    createdAt: row.created_at,
  };
}

export async function insertExpense(input: ExpenseInput): Promise<Expense> {
  const db = await getDatabase();
  const expense: Expense = {
    id: newId(),
    ...input,
    note: input.note.trim(),
    createdAt: nowIso(),
  };
  await db.runAsync(
    `INSERT INTO expenses (id, category_id, note, amount_cents, spent_on, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      expense.id,
      expense.categoryId,
      expense.note,
      expense.amountCents,
      expense.spentOn,
      expense.createdAt,
    ]
  );
  notifyDataChanged();
  return expense;
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE expenses
     SET category_id = ?, note = ?, amount_cents = ?, spent_on = ?
     WHERE id = ?`,
    [input.categoryId, input.note.trim(), input.amountCents, input.spentOn, id]
  );
  notifyDataChanged();
}

export async function deleteExpense(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
  notifyDataChanged();
}

/**
 * All expenses in a month (`yyyyMm` like '2026-07'), newest day first,
 * then newest created_at within a day — the Home list order.
 */
export async function getExpensesForMonth(yyyyMm: string): Promise<Expense[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT id, category_id, note, amount_cents, spent_on, created_at
     FROM expenses
     WHERE spent_on >= ? AND spent_on <= ?
     ORDER BY spent_on DESC, created_at DESC, id DESC`,
    [`${yyyyMm}-01`, `${yyyyMm}-31`]
  );
  return rows.map(toExpense);
}

/** Every expense, unordered — export sorts canonically itself. */
export async function getAllExpenses(): Promise<Expense[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExpenseRow>(
    'SELECT id, category_id, note, amount_cents, spent_on, created_at FROM expenses'
  );
  return rows.map(toExpense);
}

export async function listExpenseIds(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM expenses');
  return rows.map((row) => row.id);
}

export interface UpsertExpenseItem {
  id: string;
  categoryId: string;
  note: string;
  amountCents: number;
  spentOn: string;
}

/**
 * Import-only bulk upsert: existing ids are updated (created_at preserved),
 * unknown ids inserted with a fresh created_at. Runs in one exclusive
 * transaction (all-or-nothing) and emits a single change notification.
 */
export async function bulkUpsertExpenses(
  items: UpsertExpenseItem[]
): Promise<{ inserted: number; updated: number }> {
  const db = await getDatabase();
  let inserted = 0;
  let updated = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const item of items) {
      const result = await txn.runAsync(
        `UPDATE expenses
         SET category_id = ?, note = ?, amount_cents = ?, spent_on = ?
         WHERE id = ?`,
        [item.categoryId, item.note, item.amountCents, item.spentOn, item.id]
      );
      if (result.changes === 0) {
        await txn.runAsync(
          `INSERT INTO expenses (id, category_id, note, amount_cents, spent_on, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [item.id, item.categoryId, item.note, item.amountCents, item.spentOn, nowIso()]
        );
        inserted += 1;
      } else {
        updated += 1;
      }
    }
  });
  if (items.length > 0) notifyDataChanged();
  return { inserted, updated };
}

/**
 * Per-category totals for spent_on in [startDate, endDate] (inclusive ISO
 * dates), largest first. Categories with no spend in the period are omitted.
 */
export async function getCategorySummary(
  startDate: string,
  endDate: string
): Promise<CategorySummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    category_id: string;
    name: string;
    total_cents: number;
  }>(
    `SELECT e.category_id, c.name, SUM(e.amount_cents) AS total_cents
     FROM expenses e
     JOIN categories c ON c.id = e.category_id
     WHERE e.spent_on >= ? AND e.spent_on <= ?
     GROUP BY e.category_id, c.name
     ORDER BY total_cents DESC, c.name`,
    [startDate, endDate]
  );
  return rows.map((row) => ({
    categoryId: row.category_id,
    name: row.name,
    totalCents: row.total_cents,
  }));
}
