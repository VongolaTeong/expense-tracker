import { groupExpensesByDay } from '../domain/grouping';
import type { Expense } from '../domain/types';

let counter = 0;

function expense(spentOn: string, note = '', createdAt?: string): Expense {
  counter += 1;
  return {
    id: `id-${counter}`,
    categoryId: 'cat-1',
    note,
    amountCents: 100,
    spentOn,
    createdAt: createdAt ?? `2026-07-05T12:00:${String(counter).padStart(2, '0')}Z`,
  };
}

describe('groupExpensesByDay', () => {
  it('returns no sections for an empty list', () => {
    expect(groupExpensesByDay([])).toEqual([]);
  });

  it('groups same-day expenses into one section with a label', () => {
    const a = expense('2026-07-04', 'lunch');
    const b = expense('2026-07-04', 'coffee');
    const sections = groupExpensesByDay([a, b]);
    expect(sections).toHaveLength(1);
    expect(sections[0].date).toBe('2026-07-04');
    expect(sections[0].dayLabel).toBe('Sat, 4 Jul');
    expect(sections[0].items).toEqual([a, b]);
  });

  it('orders sections newest day first and preserves item order within a day', () => {
    const newest = expense('2026-07-05', 'dinner');
    const older1 = expense('2026-07-03', 'bus');
    const older2 = expense('2026-07-03', 'train');
    const oldest = expense('2026-06-30', 'rent');
    const sections = groupExpensesByDay([newest, older1, older2, oldest]);
    expect(sections.map((s) => s.date)).toEqual(['2026-07-05', '2026-07-03', '2026-06-30']);
    expect(sections[1].items).toEqual([older1, older2]);
  });

  it('coalesces same-day rows even when the input is not date-sorted', () => {
    const a = expense('2026-07-04');
    const b = expense('2026-07-03');
    const c = expense('2026-07-04');
    const sections = groupExpensesByDay([a, b, c]);
    expect(sections.map((s) => s.date)).toEqual(['2026-07-04', '2026-07-03']);
    expect(sections[0].items).toEqual([a, c]);
  });

  it('sorts sections across month and year boundaries', () => {
    const jan = expense('2026-01-01');
    const dec = expense('2025-12-31');
    const sections = groupExpensesByDay([dec, jan]);
    expect(sections.map((s) => s.date)).toEqual(['2026-01-01', '2025-12-31']);
  });
});
