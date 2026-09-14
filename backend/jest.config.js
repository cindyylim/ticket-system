/** @type {import('ts-jest').JestConfigWithTsJest} */
process.env.REDIS_URI = process.env.REDIS_URI || 'redis://127.0.0.1:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

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
