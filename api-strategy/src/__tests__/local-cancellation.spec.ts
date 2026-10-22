import { describe, it, expect, jest } from '@jest/globals';
import { awaitLocalResponse } from '../strategies/http-abstract-call.strategy.js';
describe('local caller cancellation lifecycle', () => {
  it('does not dispatch a pre-aborted signal and preserves its custom reason', async () => {
    const reason = new Error('custom');
    const dispatch = jest.fn(async () => 1);
    await expect(
      awaitLocalResponse(dispatch, AbortSignal.abort(reason)),
    ).rejects.toBe(reason);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('removes the abort listener on normal completion', async () => {
    const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    await expect(
      awaitLocalResponse(async () => 1, controller.signal),
    ).resolves.toBe(1);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    controller.abort();
  });
  it('removes the abort listener if dispatch throws synchronously', async () => {
    const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    await expect(
      awaitLocalResponse(() => {
        throw new Error('dispatch');
      }, controller.signal),
    ).rejects.toThrow('dispatch');
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });
  it('consumes a late dispatch failure after cancellation and preserves the abort reason', async () => {
    const controller = new AbortController();
    const reason = new Error('cancel');
    let reject!: (error: Error) => void;
    const pending = new Promise<never>((_yes, no) => {
      reject = no;
    });
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const execution = awaitLocalResponse(() => {
      entered();
      return pending;
    }, controller.signal);
    await started;
    controller.abort(reason);
    await expect(execution).rejects.toBe(reason);
    reject(new Error('late dispatch failure'));
    await new Promise((resolve) => setImmediate(resolve));
  });
  it('contains cancellation and a synchronous dispatch throw in the same turn', async () => {
    const controller = new AbortController();
    const reason = new Error('cancel during dispatch');
    const unhandled = jest.fn();
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    process.on('unhandledRejection', unhandled);
    try {
      const execution = awaitLocalResponse(() => {
        controller.abort(reason);
        throw new Error('dispatch failed after abort');
      }, controller.signal);
      await expect(execution).rejects.toBe(reason);
      await new Promise((resolve) => setImmediate(resolve));
      expect(unhandled).not.toHaveBeenCalled();
      expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    } finally {
      process.removeListener('unhandledRejection', unhandled);
    }
  });
  it('does not dispatch if cancellation arrives before the dispatch microtask', async () => {
    const controller = new AbortController();
    const reason = new Error('cancel before dispatch');
    const dispatch = jest.fn(async () => 1);
    const execution = awaitLocalResponse(dispatch, controller.signal);
    controller.abort(reason);
    await expect(execution).rejects.toBe(reason);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
