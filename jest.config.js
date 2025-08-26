module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        useESM: false,
        diagnostics: {
          ignoreCodes: [1343],
        },
      },
    ],
  },
  collectCoverageFrom: ['src/**/*.(t|j)s', 'test/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  modulePaths: ['<rootDir>/src', '<rootDir>/node_modules'],
  roots: ['<rootDir>/src', '<rootDir>/test'],
  clearMocks: true,
  restoreMocks: true,
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', 'dist/'],
};