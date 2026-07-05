// Phase 0 sanity check: proves TypeScript tests run in plain Node.
// Replaced by real domain/CSV tests in Phases 2–3.
describe('jest setup', () => {
  it('compiles and runs strict TypeScript', () => {
    const sum = (a: number, b: number): number => a + b;
    expect(sum(2, 3)).toBe(5);
  });
});
