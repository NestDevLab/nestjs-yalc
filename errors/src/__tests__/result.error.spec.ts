import { describe, expect, it } from '@jest/globals';
import { tryCatch, tryCatchAsync } from '../result.error.js';
import { DefaultError } from '../default.error.js';

describe('ResultError', () => {
  it('should handle sync success', () => {
    const result = tryCatch(() => 'success');
    if (result.isErr()) {
      expect(true).toBe(false);
      return;
    }
    expect(result.isOk()).toBe(true);
    expect(result.value).toBe('success');
  });

  it('should handle sync error', () => {
    const result = tryCatch(() => {
      throw new Error('error');
    });
    if (result.isOk()) {
      expect(true).toBe(false);
      return;
    }
    expect(result.error).toBeInstanceOf(DefaultError);
  });

  it('should handle async success', async () => {
    const result = await tryCatchAsync(async () => 'success');
    if (result.isErr()) {
      expect(true).toBe(false);
      return;
    }
    expect(result.isOk()).toBe(true);
    expect(result.value).toBe('success');
  });

  it('should handle async error', async () => {
    const result = await tryCatchAsync(async () => {
      throw new Error('error');
    });
    if (result.isOk()) {
      expect(true).toBe(false);
      return;
    }
    expect(result.error).toBeInstanceOf(DefaultError);
  });
});
