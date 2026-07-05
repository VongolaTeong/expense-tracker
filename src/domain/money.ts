/**
 * Money helpers. Pure — no Expo imports.
 * Amounts are integer cents everywhere in code; decimal strings exist only
 * at the display and CSV boundary, and this module is that boundary.
 */

export type AmountParseError = 'empty' | 'invalid' | 'tooManyDecimals';

export type AmountParseResult =
  | { ok: true; cents: number }
  | { ok: false; error: AmountParseError };

/** Digits with at most one dot: "12", "12.", "12.3", ".5" … */
const AMOUNT_RE = /^(\d*)(?:\.(\d*))?$/;

/** 10 integer digits keeps cents far inside Number.MAX_SAFE_INTEGER. */
const MAX_INT_DIGITS = 10;

/**
 * Parses user-typed amount input into cents without any float arithmetic.
 * Partial-but-unambiguous input like "12." is accepted (1200) so live
 * validation doesn't flag a user mid-typing; ""/"." are not amounts.
 * Zero parses fine — "must be > 0 to save" is the UI's rule, not ours.
 */
export function parseAmountInput(input: string): AmountParseResult {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: false, error: 'empty' };
  const match = AMOUNT_RE.exec(trimmed);
  if (!match) return { ok: false, error: 'invalid' };
  const intPart = match[1] ?? '';
  const fracPart = match[2] ?? '';
  if (intPart === '' && fracPart === '') return { ok: false, error: 'invalid' }; // "."
  if (fracPart.length > 2) return { ok: false, error: 'tooManyDecimals' };
  if (intPart.length > MAX_INT_DIGITS) return { ok: false, error: 'invalid' };
  const cents = Number(intPart || '0') * 100 + Number(fracPart.padEnd(2, '0'));
  return { ok: true, cents };
}

/** 1250 → "12.50". The single formatting path for all money display. */
export function formatAmount(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new RangeError(`formatAmount expects integer cents, got ${cents}`);
  }
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
