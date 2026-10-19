module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/migrations/**',
    '!src/domain/migrations/**',
  ],
};
