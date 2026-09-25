/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.base.json' }]
  },
  moduleNameMapper: {
    '^@smartpump/shared$': '<rootDir>/packages/shared/src/index.ts',
    '^@smartpump/validation$': '<rootDir>/packages/validation/src/index.ts',
    '^@smartpump/auth$': '<rootDir>/packages/auth/src/index.ts',
    '^@smartpump/mqtt$': '<rootDir>/packages/mqtt/src/index.ts',
    '^@smartpump/database$': '<rootDir>/packages/database/src/index.ts'
  }
};
