import { describe, it, expect } from '@jest/globals';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DefaultError } from '@nestjs-yalc/errors/default.error.js';
import { ImprovedNestLogger } from '@nestjs-yalc/logger';
import { eventError, eventErrorAsync, applyAwaitOption } from '../event.js';
import { YalcEventService } from '../event.service.js';

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe('Error emission completion', () => {
  it('defaults standalone async helpers to awaited emission', () => {
    expect(applyAwaitOption()).toEqual({ event: { await: true } });
    expect(applyAwaitOption({ event: false })).toEqual({ event: false });
  });

  it.each(['primary', 'string alias', 'awaited alias'])(
    'waits for a blocked %s listener',
    async (kind) => {
      const emitter = new EventEmitter2();
      const started = barrier();
      const blocked = barrier();
      const name = kind === 'primary' ? 'failure' : 'alias';
      emitter.on(name, async () => {
        started.release();
        await blocked.promise;
      });
      let settled = false;
      const pending = eventErrorAsync('failure', {
        logger: false,
        event: { emitter },
        eventAliases:
          kind === 'primary'
            ? []
            : kind === 'string alias'
              ? ['alias']
              : [{ eventName: 'alias', await: true }],
      }).then((error) => {
        settled = true;
        return error;
      });
      await started.promise;
      await Promise.resolve();
      expect(settled).toBe(false);
      blocked.release();
      expect(await pending).toBeInstanceOf(DefaultError);
    },
  );

  it.each(['primary', 'alias'])(
    'rejects when an awaited %s listener rejects',
    async (kind) => {
      const emitter = new EventEmitter2();
      const failure = new Error('listener rejected');
      emitter.on(kind === 'primary' ? 'failure' : 'alias', async () => {
        throw failure;
      });
      await expect(
        eventErrorAsync('failure', {
          logger: false,
          event: { emitter },
          eventAliases: ['alias'],
        }),
      ).rejects.toBe(failure);
    },
  );

  it('observes primary rejection while an alias remains blocked', async () => {
    const emitter = new EventEmitter2();
    const blocked = barrier();
    const failure = new Error('primary failed');
    emitter.on('failure', async () => {
      throw failure;
    });
    emitter.on('alias', () => blocked.promise);
    try {
      await expect(
        eventErrorAsync('failure', {
          logger: false,
          event: { emitter },
          eventAliases: ['alias'],
        }),
      ).rejects.toBe(failure);
    } finally {
      blocked.release();
    }
  });

  it('rejects synchronous listener throws through the async helper', async () => {
    const emitter = new EventEmitter2();
    const failure = new Error('listener threw');
    emitter.on('failure', () => {
      throw failure;
    });
    await expect(
      eventErrorAsync('failure', { logger: false, event: { emitter } }),
    ).rejects.toBe(failure);
  });

  it('preserves explicit non-awaited emission and disabled emission', async () => {
    const emitter = new EventEmitter2();
    const blocked = barrier();
    let completed = false;
    emitter.on('failure', async () => {
      await blocked.promise;
      completed = true;
    });
    expect(
      await eventErrorAsync('failure', {
        logger: false,
        event: { emitter, await: false },
      }),
    ).toBeInstanceOf(DefaultError);
    expect(completed).toBe(false);
    blocked.release();
    expect(
      await eventErrorAsync('failure', { logger: false, event: false }),
    ).toBeInstanceOf(DefaultError);
    expect(
      await eventErrorAsync('failure', {
        logger: false,
        event: false,
        errorClass: false,
      }),
    ).toBeUndefined();
  });

  it('does not observe non-awaited alias rejections; the listener owns them', async () => {
    const emitter = new EventEmitter2();
    let rejectListener!: (error: Error) => void;
    const listenerPromise = new Promise<void>((_resolve, reject) => {
      rejectListener = reject;
    });
    const failure = new Error('detached alias failed');
    // Non-awaited EventEmitter2.emit ignores returned promises. The listener's
    // owner must observe them to prevent an unhandled rejection.
    const observed = expect(listenerPromise).rejects.toBe(failure);
    emitter.on('alias', () => listenerPromise);
    const error = await eventErrorAsync('failure', {
      logger: false,
      event: { emitter },
      eventAliases: [{ eventName: 'alias', await: false }],
    });
    expect(error).toBeInstanceOf(DefaultError);
    rejectListener(failure);
    await observed;
  });

  it('does not invoke primary or alias listeners when emission is disabled', async () => {
    const emitter = new EventEmitter2();
    let invoked = false;
    emitter.on('failure', () => {
      invoked = true;
    });
    emitter.on('alias', () => {
      invoked = true;
    });
    const service = new YalcEventService(
      new ImprovedNestLogger('test', {}),
      emitter,
    );
    expect(
      await service.errorAsync('failure', {
        logger: false,
        event: false,
        eventAliases: ['alias'],
      }),
    ).toBeInstanceOf(DefaultError);
    expect(invoked).toBe(false);
  });

  it('returns emission results when error creation is disabled', async () => {
    const emitter = new EventEmitter2();
    emitter.on('failure', async () => 'handled');
    expect(
      await eventErrorAsync('failure', {
        logger: false,
        event: { emitter },
        errorClass: false,
      }),
    ).toEqual(['handled']);
  });

  it('keeps synchronous error and Result helpers synchronous, including explicit await', async () => {
    const emitter = new EventEmitter2();
    const blocked = barrier();
    emitter.on('failure', () => blocked.promise);
    const service = new YalcEventService(
      new ImprovedNestLogger('test', {}),
      emitter,
    );
    const options = { logger: false as const, event: { await: true } };
    expect(
      eventError('failure', { ...options, event: { emitter, await: true } }),
    ).toBeInstanceOf(DefaultError);
    expect(service.error('failure', options)).toBeInstanceOf(DefaultError);
    expect(service.errorResult('failure', options).isErr()).toBe(true);
    blocked.release();
    await blocked.promise;
  });

  it('makes service.errorAsync wait and return the requested safe error', async () => {
    const emitter = new EventEmitter2();
    const started = barrier();
    const blocked = barrier();
    emitter.on('failure', async () => {
      started.release();
      await blocked.promise;
    });
    const service = new YalcEventService(
      new ImprovedNestLogger('test', {}),
      emitter,
    );
    let settled = false;
    const pending = service
      .errorAsync('failure', {
        logger: false,
        data: { secret: 'internal' },
        response: { message: 'Safe' },
      })
      .then((error) => {
        settled = true;
        return error;
      });
    await started.promise;
    await Promise.resolve();
    expect(settled).toBe(false);
    blocked.release();
    const error = await pending;
    expect(error).toBeInstanceOf(DefaultError);
    expect(error.getResponse()).not.toHaveProperty('secret');
    expect(error.getResponse()).toMatchObject({ message: 'Safe' });
  });
});
