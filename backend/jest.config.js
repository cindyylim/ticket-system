/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: 'src',
    testMatch: ['**/tests/**/*.test.ts'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    collectCoverage: true,
    coverageDirectory: '../coverage',
    coveragePathIgnorePatterns: ['/node_modules/'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1'
    }
};
