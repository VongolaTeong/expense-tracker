import type { CsvExpenseRow } from '../services/csv';
import { normalizeCategoryName, planImport } from '../services/importPlan';
import type { ImportPlan } from '../services/importPlan';
import type { Category } from '../domain/types';

function category(id: string, name: string, sortOrder: number): Category {
  return { id, name, sortOrder, createdAt: '2026-01-01T00:00:00.000Z' };
}

function row(
  id: string,
  categoryName: string,
  overrides: Partial<Pick<CsvExpenseRow, 'date' | 'note' | 'amountCents'>> = {}
): CsvExpenseRow {
  return {
    id,
    date: overrides.date ?? '2026-07-04',
    category: categoryName,
    note: overrides.note ?? '',
    amountCents: overrides.amountCents ?? 100,
  };
}

const EXISTING = [category('c-food', 'Food', 0), category('c-transport', 'Transport', 1)];

describe('planImport', () => {
  it('matches known categories case-insensitively and collects unknown ones once', () => {
    const plan = planImport(
      [
        row('a', 'food'), // known, different case
        row('b', 'Travel'), // unknown
        row('c', 'travel'), // same unknown, different case
        row('d', ' Travel '), // same unknown, padded
        row('e', 'Snacks'), // second unknown
      ],
      EXISTING,
      new Set()
    );
    expect(plan.newCategoryNames).toEqual(['Travel', 'Snacks']); // first-seen casing, in order
    expect(plan.upserts).toHaveLength(5);
  });

  it('flags existing expense ids as updates and unknown ids as inserts', () => {
    const plan = planImport(
      [row('known-id', 'Food'), row('new-id', 'Food')],
      EXISTING,
      new Set(['known-id'])
    );
    expect(plan.upserts.find((u) => u.id === 'known-id')?.exists).toBe(true);
    expect(plan.upserts.find((u) => u.id === 'new-id')?.exists).toBe(false);
  });

  it('collapses duplicate ids to one upsert — last occurrence wins', () => {
    const plan = planImport(
      [row('dup', 'Food', { note: 'first', amountCents: 100 }), row('dup', 'Food', { note: 'second', amountCents: 200 })],
      EXISTING,
      new Set()
    );
    expect(plan.upserts).toHaveLength(1);
    expect(plan.upserts[0].note).toBe('second');
    expect(plan.upserts[0].amountCents).toBe(200);
  });

  it('trims category names on planned upserts', () => {
    const plan = planImport([row('a', '  Food  ')], EXISTING, new Set());
    expect(plan.upserts[0].categoryName).toBe('Food');
    expect(plan.newCategoryNames).toEqual([]); // matched existing 'Food'
  });
});

// ── Import-twice: second import of the same file changes nothing ────────────

interface FakeStore {
  categories: Category[];
  expenses: Map<
    string,
    { categoryId: string; note: string; amountCents: number; spentOn: string }
  >;
}

/** Mirrors what services/importer.ts does with a plan, against a fake store. */
function applyPlan(plan: ImportPlan, store: FakeStore): FakeStore {
  const categories = [...store.categories];
  for (const name of plan.newCategoryNames) {
    categories.push(category(`created-${normalizeCategoryName(name)}`, name, categories.length));
  }
  const idByName = new Map(categories.map((c) => [normalizeCategoryName(c.name), c.id]));
  const expenses = new Map(store.expenses);
  for (const upsert of plan.upserts) {
    const categoryId = idByName.get(normalizeCategoryName(upsert.categoryName));
    if (categoryId === undefined) throw new Error('unresolved category');
    expenses.set(upsert.id, {
      categoryId,
      note: upsert.note,
      amountCents: upsert.amountCents,
      spentOn: upsert.spentOn,
    });
  }
  return { categories, expenses };
}

describe('import-twice idempotence', () => {
  const fileRows = [
    row('e1', 'Food', { note: 'lunch', amountCents: 550 }),
    row('e2', 'Travel', { note: '', amountCents: 1200, date: '2026-07-01' }),
    row('e3', 'travel', { note: 'bus', amountCents: 129 }),
  ];

  it('second import creates no categories, inserts nothing, and leaves the store identical', () => {
    const initial: FakeStore = { categories: EXISTING, expenses: new Map() };

    const firstPlan = planImport(fileRows, initial.categories, new Set(initial.expenses.keys()));
    expect(firstPlan.newCategoryNames).toEqual(['Travel']);
    expect(firstPlan.upserts.every((u) => !u.exists)).toBe(true); // all inserts
    const afterFirst = applyPlan(firstPlan, initial);
    expect(afterFirst.expenses.size).toBe(3);

    const secondPlan = planImport(
      fileRows,
      afterFirst.categories,
      new Set(afterFirst.expenses.keys())
    );
    expect(secondPlan.newCategoryNames).toEqual([]); // no duplicate categories
    expect(secondPlan.upserts.every((u) => u.exists)).toBe(true); // all updates
    const afterSecond = applyPlan(secondPlan, afterFirst);

    expect(afterSecond.expenses.size).toBe(3); // zero duplicates
    expect(afterSecond.categories).toEqual(afterFirst.categories);
    expect([...afterSecond.expenses.entries()]).toEqual([...afterFirst.expenses.entries()]);
  });
});
