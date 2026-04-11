module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/__tests__/**/*.spec.ts'],
  setupFiles: ['reflect-metadata'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/src/__tests__/tsconfig.json',
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@nestjs-yalc/([^/]+)$': '<rootDir>/../../../$1/src/index.ts',
    '^@nestjs-yalc/([^/]+)/(.*)\\.js$': '<rootDir>/../../../$1/src/$2.ts',
  },
};
