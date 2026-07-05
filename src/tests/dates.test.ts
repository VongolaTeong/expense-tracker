import {
  addDays,
  dayLabel,
  isFutureMonthKey,
  isFuturePeriod,
  isValidIsoDate,
  monthBounds,
  monthKeyOf,
  monthLabel,
  monthOf,
  nextMonthKey,
  nextPeriod,
  periodContaining,
  periodLabel,
  prevMonthKey,
  prevPeriod,
  todayIso,
  weekOf,
  yearOf,
} from '../domain/dates';

// Fixed reference: 2026-07-05 is a Sunday; 2026-01-01 is a Thursday, which
// also makes ISO year 2026 a 53-week year.
const TODAY = '2026-07-05';

describe('isValidIsoDate', () => {
  it('accepts real calendar dates', () => {
    expect(isValidIsoDate('2026-07-05')).toBe(true);
    expect(isValidIsoDate('2026-01-01')).toBe(true);
    expect(isValidIsoDate('2026-12-31')).toBe(true);
  });

  it('handles leap days correctly', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true); // leap
    expect(isValidIsoDate('2026-02-29')).toBe(false); // not leap
    expect(isValidIsoDate('2000-02-29')).toBe(true); // 400-year rule
    expect(isValidIsoDate('1900-02-29')).toBe(false); // 100-year rule
  });

  it('rejects out-of-range components', () => {
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2026-00-10')).toBe(false);
    expect(isValidIsoDate('2026-04-31')).toBe(false);
    expect(isValidIsoDate('2026-06-00')).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(isValidIsoDate('')).toBe(false);
    expect(isValidIsoDate('26-01-01')).toBe(false);
    expect(isValidIsoDate('2026-1-1')).toBe(false);
    expect(isValidIsoDate('2026/07/05')).toBe(false);
    expect(isValidIsoDate('2026-07-05T00:00:00')).toBe(false);
    expect(isValidIsoDate('hello')).toBe(false);
  });
});

describe('todayIso', () => {
  it('uses the local calendar date of the injected clock', () => {
    expect(todayIso(new Date(2026, 6, 5, 23, 59, 59))).toBe('2026-07-05');
    expect(todayIso(new Date(2026, 0, 1, 0, 0, 1))).toBe('2026-01-01');
  });
});

describe('addDays', () => {
  it('adds and subtracts across month and year boundaries', () => {
    expect(addDays('2026-07-05', 1)).toBe('2026-07-06');
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('crosses leap days correctly', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('throws on invalid dates', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow();
  });
});

describe('month keys', () => {
  it('extracts and bounds months', () => {
    expect(monthKeyOf('2026-07-05')).toBe('2026-07');
    expect(monthBounds('2026-07')).toEqual({ start: '2026-07-01', end: '2026-07-31' });
    expect(monthBounds('2026-04')).toEqual({ start: '2026-04-01', end: '2026-04-30' });
  });

  it('bounds February by leap year', () => {
    expect(monthBounds('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthBounds('2024-02')).toEqual({ start: '2024-02-01', end: '2024-02-29' });
  });

  it('pages across year boundaries', () => {
    expect(prevMonthKey('2026-01')).toBe('2025-12');
    expect(nextMonthKey('2026-12')).toBe('2027-01');
    expect(prevMonthKey('2026-07')).toBe('2026-06');
    expect(nextMonthKey('2026-07')).toBe('2026-08');
  });

  it('flags future months', () => {
    expect(isFutureMonthKey('2026-08', TODAY)).toBe(true);
    expect(isFutureMonthKey('2027-01', TODAY)).toBe(true);
    expect(isFutureMonthKey('2026-07', TODAY)).toBe(false);
    expect(isFutureMonthKey('2026-06', TODAY)).toBe(false);
  });

  it('rejects malformed month keys', () => {
    expect(() => monthBounds('2026-13')).toThrow();
    expect(() => monthBounds('2026-7')).toThrow();
    expect(() => isFutureMonthKey('garbage', TODAY)).toThrow();
  });
});

describe('weekOf (ISO weeks, Monday start)', () => {
  it('finds the Monday of a mid-year week', () => {
    // 2026-07-05 is a Sunday → week is Mon 29 Jun … Sun 5 Jul
    expect(weekOf('2026-07-05')).toEqual({
      type: 'week',
      start: '2026-06-29',
      end: '2026-07-05',
    });
    // A Monday is its own week start
    expect(weekOf('2026-06-29').start).toBe('2026-06-29');
  });

  it('handles the year-boundary week (Jan 1 mid-week)', () => {
    // 2026-01-01 is a Thursday → its week starts Mon 2025-12-29
    expect(weekOf('2026-01-01')).toEqual({
      type: 'week',
      start: '2025-12-29',
      end: '2026-01-04',
    });
  });

  it('handles week 53 of a 53-week ISO year', () => {
    // ISO year 2026 has 53 weeks; its last week is Mon 2026-12-28 … Sun 2027-01-03
    expect(weekOf('2026-12-31')).toEqual({
      type: 'week',
      start: '2026-12-28',
      end: '2027-01-03',
    });
    expect(weekOf('2027-01-03').start).toBe('2026-12-28');
  });

  it('handles the leap-day week', () => {
    // 2024-02-29 is a Thursday → Mon 2024-02-26 … Sun 2024-03-03
    expect(weekOf('2024-02-29')).toEqual({
      type: 'week',
      start: '2024-02-26',
      end: '2024-03-03',
    });
  });
});

describe('period paging', () => {
  it('pages months, including year boundaries', () => {
    const jan = monthOf('2026-01-15');
    expect(prevPeriod(jan)).toEqual({ type: 'month', start: '2025-12-01', end: '2025-12-31' });
    expect(nextPeriod(jan)).toEqual({ type: 'month', start: '2026-02-01', end: '2026-02-28' });
  });

  it('pages weeks across year boundaries', () => {
    const w53 = weekOf('2026-12-31'); // Mon 2026-12-28 … Sun 2027-01-03
    expect(nextPeriod(w53)).toEqual({ type: 'week', start: '2027-01-04', end: '2027-01-10' });
    expect(prevPeriod(w53)).toEqual({ type: 'week', start: '2026-12-21', end: '2026-12-27' });
    expect(prevPeriod(nextPeriod(w53))).toEqual(w53);
  });

  it('pages years', () => {
    const y = yearOf('2026-07-05');
    expect(y).toEqual({ type: 'year', start: '2026-01-01', end: '2026-12-31' });
    expect(prevPeriod(y)).toEqual({ type: 'year', start: '2025-01-01', end: '2025-12-31' });
    expect(nextPeriod(y)).toEqual({ type: 'year', start: '2027-01-01', end: '2027-12-31' });
  });

  it('periodContaining dispatches by type', () => {
    expect(periodContaining('week', TODAY)).toEqual(weekOf(TODAY));
    expect(periodContaining('month', TODAY)).toEqual(monthOf(TODAY));
    expect(periodContaining('year', TODAY)).toEqual(yearOf(TODAY));
  });
});

describe('isFuturePeriod', () => {
  it('blocks periods that start after today', () => {
    expect(isFuturePeriod(nextPeriod(weekOf(TODAY)), TODAY)).toBe(true);
    expect(isFuturePeriod(nextPeriod(monthOf(TODAY)), TODAY)).toBe(true);
    expect(isFuturePeriod(nextPeriod(yearOf(TODAY)), TODAY)).toBe(true);
  });

  it('allows current and past periods (even when they extend past today)', () => {
    // Current week/month/year all contain today, so they are not future,
    // even though their end dates lie ahead.
    expect(isFuturePeriod(weekOf(TODAY), TODAY)).toBe(false);
    expect(isFuturePeriod(monthOf(TODAY), TODAY)).toBe(false);
    expect(isFuturePeriod(yearOf(TODAY), TODAY)).toBe(false);
    expect(isFuturePeriod(prevPeriod(weekOf(TODAY)), TODAY)).toBe(false);
  });
});

describe('labels', () => {
  it('day separator labels', () => {
    expect(dayLabel('2026-07-04')).toBe('Sat, 4 Jul');
    expect(dayLabel('2026-07-05')).toBe('Sun, 5 Jul');
    expect(dayLabel('2026-01-01')).toBe('Thu, 1 Jan');
    expect(dayLabel('2024-02-29')).toBe('Thu, 29 Feb');
  });

  it('month labels', () => {
    expect(monthLabel('2026-07')).toBe('July 2026');
    expect(monthLabel('2025-12')).toBe('December 2025');
    expect(periodLabel(monthOf('2026-07-05'))).toBe('July 2026');
  });

  it('year labels', () => {
    expect(periodLabel(yearOf('2026-03-01'))).toBe('2026');
  });

  it('week labels collapse shared month/year', () => {
    // Same month: Mon 6 Jul … Sun 12 Jul 2026
    expect(periodLabel(weekOf('2026-07-06'))).toBe('6 – 12 Jul 2026');
    // Cross-month, same year
    expect(periodLabel(weekOf('2026-07-05'))).toBe('29 Jun – 5 Jul 2026');
    // Cross-year
    expect(periodLabel(weekOf('2026-01-01'))).toBe('29 Dec 2025 – 4 Jan 2026');
  });
});
