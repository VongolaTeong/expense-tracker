import { CATEGORY_PALETTE, categoryColor } from '../domain/colors';

describe('categoryColor', () => {
  it('is deterministic — same id always maps to the same color', () => {
    const ids = [
      '7f3c1a2e-0000-4000-8000-000000000001',
      'c-food',
      'imported-cat-3',
      '',
    ];
    for (const id of ids) {
      expect(categoryColor(id)).toBe(categoryColor(id));
    }
  });

  it('always returns a palette color', () => {
    const palette: readonly string[] = CATEGORY_PALETTE;
    for (const id of ['a', 'ab', 'abc', 'x'.repeat(200), '2f7e-uuid', '']) {
      expect(palette).toContain(categoryColor(id));
    }
  });

  it('spreads distinct ids across more than one color', () => {
    const colors = new Set(
      ['c-food', 'c-transport', 'c-bills', 'c-health', 'c-shopping', 'c-other'].map(
        categoryColor
      )
    );
    expect(colors.size).toBeGreaterThan(1);
  });
});
