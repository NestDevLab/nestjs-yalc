import {
  describe,
  expect,
  it,
  jest,
  beforeAll,
  beforeEach,
  test,
} from '@jest/globals';

import { ___dirname, __filename } from '../files.helper.js';

describe('Test files.helper.ts', () => {
  it('should run __filename', () => {
    expect(__filename(import.meta.url)).toBeDefined();
  });

  it('should run ___dirname', () => {
    const dir = ___dirname(import.meta.url);
    expect(dir).toContain('utils/src/__tests__');
  });
});
