import { describe, expect, it } from '@jest/globals';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { UnwrapResultInterceptor } from '../unwrap-result.interceptor.js';

const ctx = {
  switchToHttp: () => ({
    getRequest: () => ({}),
  }),
} as unknown as ExecutionContext;

describe('UnwrapResultInterceptor', () => {
  const interceptor = new UnwrapResultInterceptor();

  it('should unwrap successful Result-like objects', async () => {
    const next: CallHandler = {
      handle: () =>
        of({
          isOk: () => true,
          isErr: () => false,
          value: 'payload',
        }),
    };

    const result = await firstValueFrom(interceptor.intercept(ctx, next));
    expect(result).toBe('payload');
  });

  it('should throw when Result-like object contains error', async () => {
    const error = new Error('boom');
    const next: CallHandler = {
      handle: () =>
        of({
          isOk: () => false,
          isErr: () => true,
          error,
        }),
    };

    await expect(firstValueFrom(interceptor.intercept(ctx, next))).rejects.toThrow('boom');
  });

  it('should pass through non Result objects', async () => {
    const payload = { ok: true };
    const next: CallHandler = {
      handle: () => of(payload),
    };

    const result = await firstValueFrom(interceptor.intercept(ctx, next));
    expect(result).toBe(payload);
  });
});
