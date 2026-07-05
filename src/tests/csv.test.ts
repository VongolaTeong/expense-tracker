import { CSV_HEADER, exportToCsv, parseCsv } from '../services/csv';
import type { CsvExpenseRow } from '../services/csv';
import type { Category, Expense } from '../domain/types';

// ── fixtures ─────────────────────────────────────────────────────────────────

function category(id: string, name: string, sortOrder: number): Category {
  return { id, name, sortOrder, createdAt: '2026-01-01T00:00:00.000Z' };
}

function expense(
  id: string,
  categoryId: string,
  spentOn: string,
  amountCents: number,
  note = ''
): Expense {
  return { id, categoryId, note, amountCents, spentOn, createdAt: '2026-07-01T10:00:00.000Z' };
}

const CATS = [category('c-food', 'Food', 0), category('c-transport', 'Transport', 1)];

// ── exportToCsv ──────────────────────────────────────────────────────────────

describe('exportToCsv', () => {
  it('writes the exact header, LF endings, and a trailing newline', () => {
    const csv = exportToCsv([expense('a', 'c-food', '2026-07-04', 550, 'chicken rice')], CATS);
    expect(csv).toBe('id,date,category,note,amount\na,2026-07-04,Food,chicken rice,5.50\n');
    expect(csv).not.toContain('\r');
  });

  it('leaves empty notes as empty fields', () => {
    const csv = exportToCsv([expense('a', 'c-transport', '2026-07-04', 129)], CATS);
    expect(csv.split('\n')[1]).toBe('a,2026-07-04,Transport,,1.29');
  });

  it('quotes fields containing commas, quotes, and newlines per RFC 4180', () => {
    const rows = [
      expense('a', 'c-food', '2026-07-01', 100, 'rice, egg'),
      expense('b', 'c-food', '2026-07-02', 200, 'the "good" stuff'),
      expense('c', 'c-food', '2026-07-03', 300, 'line one\nline two'),
    ];
    const lines = exportToCsv(rows, CATS).split('\n');
    expect(lines[1]).toBe('a,2026-07-01,Food,"rice, egg",1.00');
    expect(lines[2]).toBe('b,2026-07-02,Food,"the ""good"" stuff",2.00');
    // The newline note spans two physical lines inside one quoted field
    expect(lines[3]).toBe('c,2026-07-03,Food,"line one');
    expect(lines[4]).toBe('line two",3.00');
  });

  it('orders rows canonically (date, then id) regardless of input order', () => {
    const shuffled = [
      expense('z', 'c-food', '2026-07-04', 100),
      expense('a', 'c-food', '2026-07-04', 200),
      expense('m', 'c-food', '2026-07-01', 300),
    ];
    const ids = exportToCsv(shuffled, CATS)
      .trim()
      .split('\n')
      .slice(1)
      .map((l) => l.split(',')[0]);
    expect(ids).toEqual(['m', 'a', 'z']);
  });

  it('exports header only for zero expenses', () => {
    expect(exportToCsv([], CATS)).toBe(`${CSV_HEADER}\n`);
  });

  it('throws when an expense references a missing category', () => {
    expect(() => exportToCsv([expense('a', 'c-nope', '2026-07-04', 100)], CATS)).toThrow(
      /unknown category/
    );
  });
});

// ── parseCsv ─────────────────────────────────────────────────────────────────

describe('parseCsv', () => {
  const HEADER = `${CSV_HEADER}\n`;

  it('parses valid rows', () => {
    const { validRows, skippedCount } = parseCsv(
      HEADER + 'a,2026-07-04,Food,chicken rice,5.50\nb,2026-07-04,Transport,,1.29\n'
    );
    expect(skippedCount).toBe(0);
    expect(validRows).toEqual<CsvExpenseRow[]>([
      { id: 'a', date: '2026-07-04', category: 'Food', note: 'chicken rice', amountCents: 550 },
      { id: 'b', date: '2026-07-04', category: 'Transport', note: '', amountCents: 129 },
    ]);
  });

  it('tolerates CRLF line endings and a missing trailing newline', () => {
    const crlf = 'id,date,category,note,amount\r\na,2026-07-04,Food,x,5.50\r\nb,2026-07-05,Food,y,1.00';
    const { validRows, skippedCount } = parseCsv(crlf);
    expect(skippedCount).toBe(0);
    expect(validRows.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('ignores blank lines without counting them as skipped', () => {
    const { validRows, skippedCount } = parseCsv(
      HEADER + '\na,2026-07-04,Food,x,5.50\n\n\nb,2026-07-05,Food,y,1.00\n\n'
    );
    expect(validRows).toHaveLength(2);
    expect(skippedCount).toBe(0);
  });

  it('unescapes quoted fields: commas, doubled quotes, embedded newlines', () => {
    const { validRows } = parseCsv(
      HEADER +
        'a,2026-07-01,Food,"rice, egg",1.00\n' +
        'b,2026-07-02,Food,"the ""good"" stuff",2.00\n' +
        'c,2026-07-03,Food,"line one\nline two",3.00\n' +
        'd,2026-07-04,Food,"crlf\r\ninside",4.00\n'
    );
    expect(validRows.map((r) => r.note)).toEqual([
      'rice, egg',
      'the "good" stuff',
      'line one\nline two',
      'crlf\r\ninside',
    ]);
  });

  it('throws on a missing or wrong header', () => {
    expect(() => parseCsv('')).toThrow(/header/);
    expect(() => parseCsv('a,2026-07-04,Food,x,5.50\n')).toThrow(/header/);
    expect(() => parseCsv('ID,Date,Category,Note,Amount\n')).toThrow(/header/);
    expect(() => parseCsv('id,date,category,amount\n')).toThrow(/header/);
    expect(() => parseCsv('id,date,category,note,amount,extra\n')).toThrow(/header/);
  });

  it('accepts a header-only file as zero rows', () => {
    expect(parseCsv(HEADER)).toEqual({ validRows: [], skippedCount: 0 });
  });

  it('skips and counts rows with bad dates', () => {
    const { validRows, skippedCount } = parseCsv(
      HEADER +
        'a,2026-02-30,Food,x,1.00\n' + // impossible date
        'b,04-07-2026,Food,x,1.00\n' + // wrong format
        'c,2026-07-04,Food,x,1.00\n'
    );
    expect(validRows.map((r) => r.id)).toEqual(['c']);
    expect(skippedCount).toBe(2);
  });

  it('skips and counts rows with bad amounts (non-numeric, negative, >2dp, zero)', () => {
    const { validRows, skippedCount } = parseCsv(
      HEADER +
        'a,2026-07-04,Food,x,abc\n' +
        'b,2026-07-04,Food,x,-5\n' +
        'c,2026-07-04,Food,x,1.234\n' +
        'd,2026-07-04,Food,x,0.00\n' +
        'e,2026-07-04,Food,x,5.50\n'
    );
    expect(validRows.map((r) => r.id)).toEqual(['e']);
    expect(skippedCount).toBe(4);
  });

  it('skips rows with wrong field count, empty id, or empty category', () => {
    const { validRows, skippedCount } = parseCsv(
      HEADER +
        'a,2026-07-04,Food,1.00\n' + // 4 fields
        'b,2026-07-04,Food,x,1.00,extra\n' + // 6 fields
        ',2026-07-04,Food,x,1.00\n' + // empty id
        'd,2026-07-04,,x,1.00\n' + // empty category
        'e,2026-07-04,Food,x,1.00\n'
    );
    expect(validRows.map((r) => r.id)).toEqual(['e']);
    expect(skippedCount).toBe(4);
  });

  it('counts an unterminated quote as one skipped row and keeps earlier rows', () => {
    const { validRows, skippedCount } = parseCsv(
      HEADER + 'a,2026-07-04,Food,x,5.50\nb,2026-07-05,Food,"never closed,1.00\n'
    );
    expect(validRows.map((r) => r.id)).toEqual(['a']);
    expect(skippedCount).toBe(1);
  });

  it('keeps duplicate ids (importer upsert makes last-one-wins)', () => {
    const { validRows } = parseCsv(
      HEADER + 'a,2026-07-04,Food,first,1.00\na,2026-07-04,Food,second,2.00\n'
    );
    expect(validRows).toHaveLength(2);
  });
});

// ── Round-trip: the phase gate ───────────────────────────────────────────────

describe('round-trip (export → parse → export)', () => {
  // Simulates the Phase 8 importer against an empty DB: recreate categories
  // from names (fresh ids), then rebuild expenses from parsed rows.
  function importIntoEmptyDb(rows: CsvExpenseRow[]): {
    expenses: Expense[];
    categories: Category[];
  } {
    const categories: Category[] = [];
    const idByName = new Map<string, string>();
    for (const row of rows) {
      if (!idByName.has(row.category)) {
        const id = `imported-cat-${idByName.size}`;
        idByName.set(row.category, id);
        categories.push(category(id, row.category, idByName.size - 1));
      }
    }
    const expenses = rows.map((row) =>
      expense(row.id, idByName.get(row.category) as string, row.date, row.amountCents, row.note)
    );
    return { expenses, categories };
  }

  const gnarlyCats = [
    category('c1', 'Food', 0),
    category('c2', 'Food, drinks & "extras"', 1), // user-created hostile name
    category('c3', 'Transport', 2),
  ];

  const gnarlyExpenses = [
    expense('id-01', 'c1', '2026-07-04', 550, 'chicken rice'),
    expense('id-02', 'c3', '2026-07-04', 129), // empty note
    expense('id-03', 'c1', '2026-07-01', 1999, 'comma, in note'),
    expense('id-04', 'c2', '2026-06-30', 5, 'he said "hi"'),
    expense('id-05', 'c1', '2026-06-30', 123456, 'line one\nline two'),
    expense('id-06', 'c3', '2026-02-28', 1, ' leading and trailing spaces '),
    expense('id-07', 'c2', '2024-02-29', 7700, 'nasi lemak 🍛'), // leap day + unicode
    expense('id-08', 'c1', '2026-07-04', 550, 'same day+amount, different id'),
  ];

  it('produces byte-identical output after importing into an empty DB', () => {
    const first = exportToCsv(gnarlyExpenses, gnarlyCats);
    const parsed = parseCsv(first);
    expect(parsed.skippedCount).toBe(0);
    expect(parsed.validRows).toHaveLength(gnarlyExpenses.length);

    const db = importIntoEmptyDb(parsed.validRows);
    const second = exportToCsv(db.expenses, db.categories);
    expect(second).toBe(first);
  });

  it('is insensitive to input ordering (canonical export order)', () => {
    const first = exportToCsv(gnarlyExpenses, gnarlyCats);
    const reversed = exportToCsv([...gnarlyExpenses].reverse(), gnarlyCats);
    expect(reversed).toBe(first);
  });

  it('survives a second round-trip unchanged (idempotence)', () => {
    const first = exportToCsv(gnarlyExpenses, gnarlyCats);
    const once = importIntoEmptyDb(parseCsv(first).validRows);
    const secondCsv = exportToCsv(once.expenses, once.categories);
    const twice = importIntoEmptyDb(parseCsv(secondCsv).validRows);
    expect(exportToCsv(twice.expenses, twice.categories)).toBe(first);
  });
});
