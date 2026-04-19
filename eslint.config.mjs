import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

const ignores = [
  '**/node_modules/**',
  '**/*spec.ts',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/jest.config.ts',
  '**/dist/**',
  'var/**',
];

const prettierRules = {
  ...prettierConfig.rules,
  'prettier/prettier': ['error', { singleQuote: true, trailingComma: 'all' }],
};

const tsPluginCompat = {
  ...tsPlugin,
  rules: {
    ...tsPlugin.rules,
    'ban-types': {
      meta: {
        type: 'problem',
        docs: {},
        schema: [],
        messages: {},
      },
      create() {
        return {};
      },
    },
  },
};

export default [
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  { ignores },
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...prettierRules,
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: 'tsconfig.dev.json',
        sourceType: 'module',
        tsconfigRootDir,
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      '@typescript-eslint': tsPluginCompat,
      prettier: prettierPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...prettierRules,
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': ['warn'],
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      eqeqeq: 'warn',
      'no-console': 'error',
      'no-redeclare': 'off',
      'no-unassigned-vars': 'off',
      'no-undef': 'off',
      'no-unused-expressions': 'off',
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
    },
  },
];
