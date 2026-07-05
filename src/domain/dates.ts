/**
 * Date helpers. Pure — no Expo imports.
 * All dates are ISO strings (YYYY-MM-DD, no time). Weeks start Monday
 * (ISO 8601). Internal arithmetic uses UTC Date construction only, so device
 * timezone never affects results; todayIso is the single place that reads
 * the device's local calendar.
 */

export type PeriodType = 'week' | 'month' | 'year';

/** A week/month/year window with inclusive ISO date bounds. */
export interface Period {
  type: PeriodType;
  start: string;
  end: string;
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_RE = /^(\d{4})-(\d{2})$/;

const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** True for well-formed, real calendar dates (rejects 2026-02-29 etc.). */
export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12) return false;
  return d >= 1 && d <= daysInMonth(y, m);
}

function parse(dateIso: string): { y: number; m: number; d: number } {
  if (!isValidIsoDate(dateIso)) throw new Error(`Invalid ISO date: "${dateIso}"`);
  return {
    y: Number(dateIso.slice(0, 4)),
    m: Number(dateIso.slice(5, 7)),
    d: Number(dateIso.slice(8, 10)),
  };
}

function toIso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y: number, m: number): number {
  // Day 0 of the next month == last day of month m; UTC avoids DST edges.
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The device's local calendar date. `now` is injectable for tests. */
export function todayIso(now: Date = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addDays(dateIso: string, days: number): string {
  const { y, m, d } = parse(dateIso);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return toIso(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/** Monday-based day of week: 0 = Monday … 6 = Sunday. */
function dayOfWeekMon0(dateIso: string): number {
  const { y, m, d } = parse(dateIso);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

// ── Month keys ('YYYY-MM') — the Home tab's currency ────────────────────────

function parseMonthKey(key: string): { y: number; m: number } {
  const match = MONTH_KEY_RE.exec(key);
  const y = match ? Number(match[1]) : NaN;
  const m = match ? Number(match[2]) : NaN;
  if (!match || m < 1 || m > 12) throw new Error(`Invalid month key: "${key}"`);
  return { y, m };
}

export function monthKeyOf(dateIso: string): string {
  parse(dateIso); // validate
  return dateIso.slice(0, 7);
}

export function monthBounds(monthKey: string): { start: string; end: string } {
  const { y, m } = parseMonthKey(monthKey);
  return { start: toIso(y, m, 1), end: toIso(y, m, daysInMonth(y, m)) };
}

export function prevMonthKey(monthKey: string): string {
  const { y, m } = parseMonthKey(monthKey);
  return m === 1 ? `${y - 1}-12` : `${String(y).padStart(4, '0')}-${String(m - 1).padStart(2, '0')}`;
}

export function nextMonthKey(monthKey: string): string {
  const { y, m } = parseMonthKey(monthKey);
  return m === 12 ? `${y + 1}-01` : `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}`;
}

/** Months after today's month can't be navigated to. */
export function isFutureMonthKey(monthKey: string, today: string): boolean {
  parseMonthKey(monthKey);
  return monthKey > monthKeyOf(today); // YYYY-MM compares lexicographically
}

// ── Periods — the Charts tab's currency ─────────────────────────────────────

export function weekOf(dateIso: string): Period {
  const start = addDays(dateIso, -dayOfWeekMon0(dateIso));
  return { type: 'week', start, end: addDays(start, 6) };
}

export function monthOf(dateIso: string): Period {
  const { start, end } = monthBounds(monthKeyOf(dateIso));
  return { type: 'month', start, end };
}

export function yearOf(dateIso: string): Period {
  const { y } = parse(dateIso);
  return { type: 'year', start: toIso(y, 1, 1), end: toIso(y, 12, 31) };
}

export function periodContaining(type: PeriodType, dateIso: string): Period {
  switch (type) {
    case 'week':
      return weekOf(dateIso);
    case 'month':
      return monthOf(dateIso);
    case 'year':
      return yearOf(dateIso);
  }
}

export function prevPeriod(period: Period): Period {
  return periodContaining(period.type, addDays(period.start, -1));
}

export function nextPeriod(period: Period): Period {
  return periodContaining(period.type, addDays(period.end, 1));
}

/** A period is future when it starts after today (its whole span is ahead). */
export function isFuturePeriod(period: Period, today: string): boolean {
  return period.start > today;
}

// ── Display labels (fixed English — no locale handling by design) ───────────

/** "2026-07-04" → "Sat, 4 Jul" — the Home list day separator. */
export function dayLabel(dateIso: string): string {
  const { m, d } = parse(dateIso);
  return `${WEEKDAYS_SHORT[dayOfWeekMon0(dateIso)]}, ${d} ${MONTHS_SHORT[m - 1]}`;
}

/** "2026-07" → "July 2026" — the Home month selector. */
export function monthLabel(monthKey: string): string {
  const { y, m } = parseMonthKey(monthKey);
  return `${MONTHS_FULL[m - 1]} ${y}`;
}

/** Pager title for any period, e.g. "6 – 12 Jul 2026" / "July 2026" / "2026". */
export function periodLabel(period: Period): string {
  switch (period.type) {
    case 'month':
      return monthLabel(period.start.slice(0, 7));
    case 'year':
      return String(parse(period.start).y);
    case 'week':
      return weekLabel(period);
  }
}

function weekLabel(period: Period): string {
  const s = parse(period.start);
  const e = parse(period.end);
  if (s.y !== e.y) {
    return `${s.d} ${MONTHS_SHORT[s.m - 1]} ${s.y} – ${e.d} ${MONTHS_SHORT[e.m - 1]} ${e.y}`;
  }
  if (s.m !== e.m) {
    return `${s.d} ${MONTHS_SHORT[s.m - 1]} – ${e.d} ${MONTHS_SHORT[e.m - 1]} ${e.y}`;
  }
  return `${s.d} – ${e.d} ${MONTHS_SHORT[s.m - 1]} ${e.y}`;
}
