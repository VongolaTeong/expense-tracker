/** Expense list sectioning. Pure — no Expo imports. */

import { dayLabel } from './dates';
import type { Expense } from './types';

export interface DaySection {
  /** ISO date shared by every item in the section. */
  date: string;
  /** e.g. "Sat, 4 Jul" — ready for the section header. */
  dayLabel: string;
  items: Expense[];
}

/**
 * Groups expenses into per-day sections, newest day first. Item order within
 * a day is the input order (repositories already return created_at DESC).
 * Input does not need to be date-sorted — same-day rows always coalesce.
 */
export function groupExpensesByDay(expenses: Expense[]): DaySection[] {
  const byDate = new Map<string, Expense[]>();
  for (const expense of expenses) {
    const bucket = byDate.get(expense.spentOn);
    if (bucket) {
      bucket.push(expense);
    } else {
      byDate.set(expense.spentOn, [expense]);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, items]) => ({ date, dayLabel: dayLabel(date), items }));
}
