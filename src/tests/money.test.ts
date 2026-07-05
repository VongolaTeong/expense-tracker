import { formatAmount, parseAmountInput } from '../domain/money';

function cents(input: string): number {
  const result = parseAmountInput(input);
  if (!result.ok) throw new Error(`expected "${input}" to parse, got ${result.error}`);
  return result.cents;
}

function error(input: string): string {
  const result = parseAmountInput(input);
  if (result.ok) throw new Error(`expected "${input}" to fail, got ${result.cents}`);
  return result.error;
}

describe('parseAmountInput', () => {
  it('parses plain and decimal amounts to cents', () => {
    expect(cents('5.50')).toBe(550);
    expect(cents('12')).toBe(1200);
    expect(cents('12.3')).toBe(1230);
    expect(cents('12.34')).toBe(1234);
    expect(cents('0.05')).toBe(5);
    expect(cents('1.29')).toBe(129);
  });

  it('accepts partial-but-unambiguous typing states', () => {
    expect(cents('12.')).toBe(1200);
    expect(cents('.5')).toBe(50);
    expect(cents('.55')).toBe(55);
  });

  it('accepts zero (the >0 rule belongs to the save button)', () => {
    expect(cents('0')).toBe(0);
    expect(cents('0.00')).toBe(0);
  });

  it('trims surrounding whitespace', () => {
    expect(cents(' 12.50 ')).toBe(1250);
  });

  it('tolerates leading zeros', () => {
    expect(cents('007.5')).toBe(750);
  });

  it('rejects empty input', () => {
    expect(error('')).toBe('empty');
    expect(error('   ')).toBe('empty');
  });

  it('rejects more than two decimal places', () => {
    expect(error('12.345')).toBe('tooManyDecimals');
    expect(error('0.001')).toBe('tooManyDecimals');
  });

  it('rejects malformed input', () => {
    expect(error('.')).toBe('invalid');
    expect(error('abc')).toBe('invalid');
    expect(error('12abc')).toBe('invalid');
    expect(error('1..2')).toBe('invalid');
    expect(error('1.2.3')).toBe('invalid');
    expect(error('-5')).toBe('invalid');
    expect(error('+5')).toBe('invalid');
    expect(error('12,50')).toBe('invalid');
    expect(error('1e3')).toBe('invalid');
    expect(error('1 2')).toBe('invalid');
  });

  it('rejects amounts too large for safe integer cents', () => {
    expect(error('12345678901')).toBe('invalid'); // 11 integer digits
    expect(cents('9999999999.99')).toBe(999999999999); // 10 digits still exact
  });

  it('never does float arithmetic (classic 0.1+0.2 traps)', () => {
    expect(cents('0.29')).toBe(29);
    expect(cents('19.99')).toBe(1999);
    expect(cents('1.13')).toBe(113);
  });
});

describe('formatAmount', () => {
  it('formats cents as a plain decimal string', () => {
    expect(formatAmount(1250)).toBe('12.50');
    expect(formatAmount(550)).toBe('5.50');
    expect(formatAmount(129)).toBe('1.29');
    expect(formatAmount(123456)).toBe('1234.56');
  });

  it('pads sub-1 amounts', () => {
    expect(formatAmount(5)).toBe('0.05');
    expect(formatAmount(50)).toBe('0.50');
    expect(formatAmount(0)).toBe('0.00');
  });

  it('handles negatives (not used by the app, but total functions are safer)', () => {
    expect(formatAmount(-1250)).toBe('-12.50');
    expect(formatAmount(-5)).toBe('-0.05');
  });

  it('throws on non-integer cents', () => {
    expect(() => formatAmount(12.5)).toThrow(RangeError);
    expect(() => formatAmount(NaN)).toThrow(RangeError);
  });

  it('round-trips with parseAmountInput', () => {
    for (const c of [0, 1, 99, 100, 550, 1234, 999999999999]) {
      expect(parseAmountInput(formatAmount(c))).toEqual({ ok: true, cents: c });
    }
  });
});
