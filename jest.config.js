/**
 * Tests cover only pure logic (src/domain, src/services) and run in plain
 * Node — no Expo/React Native runtime, hence ts-jest with a standalone
 * tsconfig instead of jest-expo.
 */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
};
