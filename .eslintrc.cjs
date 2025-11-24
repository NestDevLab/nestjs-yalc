module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  parserOptions: {
    project: 'tsconfig.dev.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  rules: {
    'prettier/prettier': ['error', { singleQuote: true, trailingComma: 'all' }],
  },
  ignorePatterns: [
    '**/node_modules',
    '**/*spec.ts',
    '**/__tests__',
    '**/__mocks__',
    '**/jest.config.ts',
    '**/dist/**',
    'var',
  ],
  overrides: [
    {
      files: ['**/*.cjs', '**/*.mjs', '**/*.js'],
      extends: ['eslint:recommended', 'plugin:prettier/recommended'],
    },
    {
      files: ['**/*.ts'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
      ],
      rules: {
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-floating-promises': ['warn'],
        'no-console': 'error',
        '@typescript-eslint/no-unused-vars': 'off',
        eqeqeq: 1,
      },
    },
  ],
};
