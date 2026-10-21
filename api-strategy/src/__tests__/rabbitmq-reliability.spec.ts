import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { EventEmitter } from 'node:events';
const connect = jest.fn<(...args: any[]) => Promise<any>>();
await jest.unstable_mockModule('amqplib', () => ({ default: { connect } }));
const { RabbitMqEventStrategy } =
  await import('../strategies/rabbitmq-event.strategy.js');
const deferred = () => {
  let resolve!: (value?: any) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<any>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function resources() {
  const channel = Object.assign(new EventEmitter(), {
    assertExchange: jest.fn<() => Promise<any>>().mockResolvedValue(undefined),
    publish: jest.fn(() => true),
    close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  });
  const connection = Object.assign(new EventEmitter(), {
    createChannel: jest.fn<() => Promise<any>>().mockResolvedValue(channel),
    close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  });
  return { channel, connection };
}
const make = (extra = {}) =>
  new RabbitMqEventStrategy({
    url: 'amqp://unused',
    exchange: 'events',
    ...extra,
  });
beforeEach(() => connect.mockReset());
describe('RabbitMQ resource lifecycle', () => {
  it('shares cold initialization and does not publish before successful assertion', async () => {
    const r = resources();
    const asserted = deferred();
    r.channel.assertExchange.mockReturnValue(asserted.promise);
    connect.mockResolvedValue(r.connection);
    const strategy = make();
    const calls = [strategy.emitAsync('a', {}), strategy.emitAsync('b', {})];
    await new Promise((resolve) => setImmediate(resolve));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(r.channel.publish).not.toHaveBeenCalled();
    asserted.resolve();
    await Promise.all(calls);
    expect(r.channel.publish).toHaveBeenCalledTimes(2);
    r.channel.publish.mockReturnValue(false);
    await expect(strategy.emitAsync('c', {})).resolves.toBe(false);
    await strategy.onModuleDestroy();
  });
  it.each(['connect', 'createChannel', 'assertExchange'])(
    'cleans failed %s setup and retries only on the next call',
    async (stage) => {
      const first = resources();
      const next = resources();
      if (stage === 'connect')
        connect.mockRejectedValueOnce(new Error('setup'));
      else {
        connect.mockResolvedValueOnce(first.connection);
        (stage === 'createChannel'
          ? first.connection.createChannel
          : first.channel.assertExchange
        ).mockRejectedValueOnce(new Error('setup'));
      }
      connect.mockResolvedValue(next.connection);
      const strategy = make();
      await expect(strategy.emitAsync('a', {})).rejects.toThrow('setup');
      if (stage !== 'connect')
        expect(first.connection.close).toHaveBeenCalledTimes(1);
      if (stage === 'assertExchange')
        expect(first.channel.close).toHaveBeenCalledTimes(1);
      await strategy.emitAsync('b', {});
      expect(next.channel.publish).toHaveBeenCalledTimes(1);
      await strategy.onModuleDestroy();
    },
  );
  it.each(['channel', 'connection'] as const)(
    'invalidates %s on error/close and ignores stale resource events',
    async (target) => {
      const first = resources();
      const next = resources();
      connect
        .mockResolvedValueOnce(first.connection)
        .mockResolvedValue(next.connection);
      const strategy = make();
      await strategy.emitAsync('a', {});
      first[target].emit('error', new Error('lost'));
      first[target].emit('close');
      await strategy.emitAsync('b', {});
      first[target].emit('error', new Error('stale'));
      await strategy.emitAsync('c', {});
      expect(connect).toHaveBeenCalledTimes(2);
      expect(first.channel.close).toHaveBeenCalledTimes(1);
      expect(first.connection.close).toHaveBeenCalledTimes(1);
      expect(next.channel.publish).toHaveBeenCalledTimes(2);
      await strategy.onModuleDestroy();
    },
  );
  it('cleans setup interrupted by a resource event', async () => {
    const r = resources();
    const assertion = deferred();
    r.channel.assertExchange.mockReturnValue(assertion.promise);
    connect.mockResolvedValue(r.connection);
    const strategy = make();
    const call = strategy.emitAsync('a', {});
    await new Promise((resolve) => setImmediate(resolve));
    r.connection.emit('close');
    assertion.resolve();
    await expect(call).rejects.toThrow('interrupted');
    expect(r.connection.close).toHaveBeenCalledTimes(1);
  });
  it('waits for initialization during shutdown, cleans it once and refuses new work', async () => {
    const pending = deferred();
    const r = resources();
    connect.mockReturnValue(pending.promise);
    const strategy = make();
    const call = strategy.emitAsync('a', {});
    await new Promise((resolve) => setImmediate(resolve));
    const shutdown = strategy.onModuleDestroy();
    pending.resolve(r.connection);
    await expect(call).rejects.toThrow('interrupted');
    await shutdown;
    expect(r.channel.publish).not.toHaveBeenCalled();
    expect(r.connection.close).toHaveBeenCalledTimes(1);
    await expect(strategy.emitAsync('b', {})).rejects.toThrow('shut down');
  });
  it('attempts both closes after failure and resets lifecycle state', async () => {
    const r = resources();
    connect.mockResolvedValue(r.connection);
    r.channel.close.mockRejectedValue(new Error('close failed'));
    const strategy = make();
    await strategy.emitAsync('a', {});
    await expect(strategy.onModuleDestroy()).rejects.toThrow('close failed');
    expect(r.connection.close).toHaveBeenCalledTimes(1);
    await expect(strategy.onModuleDestroy()).rejects.toThrow('close failed');
    await expect(strategy.emitAsync('a', {})).rejects.toThrow('shut down');
  });
  it('observes background failures and contains failed diagnostics', async () => {
    const onBackgroundError = jest
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error('diagnostics'));
    connect.mockRejectedValue(new Error('offline'));
    const strategy = make({ onBackgroundError });
    expect(strategy.emit('a', {})).toBe(true);
    await new Promise((resolve) => setImmediate(resolve));
    expect(onBackgroundError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'offline' }),
    );
  });
  it('does not start a connection when shutdown precedes the initialization microtask', async () => {
    const strategy = make();
    const call = strategy.emitAsync('a', {});
    const shutdown = strategy.onModuleDestroy();
    await expect(call).rejects.toThrow('shut down');
    await shutdown;
    expect(connect).not.toHaveBeenCalled();
  });
  it.each(['shutdown', 'close'])(
    'refuses a cached channel invalidated by %s before publication resumes',
    async (cause) => {
      const r = resources();
      connect.mockResolvedValue(r.connection);
      const strategy = make();
      await strategy.emitAsync('initial', {});
      const call = strategy.emitAsync('a', {});
      const shutdown =
        cause === 'shutdown' ? strategy.onModuleDestroy() : undefined;
      if (cause === 'close') r.channel.emit('close');
      await expect(call).rejects.toThrow('no longer available');
      await shutdown;
      expect(r.channel.publish).toHaveBeenCalledTimes(1);
      await strategy.onModuleDestroy();
    },
  );
  it('keeps the original setup failure when partial cleanup fails', async () => {
    const r = resources();
    connect.mockResolvedValue(r.connection);
    r.channel.assertExchange.mockRejectedValue(new Error('assert failed'));
    r.channel.close.mockRejectedValue(new Error('cleanup failed'));
    const strategy = make();
    await expect(strategy.emitAsync('a', {})).rejects.toThrow('assert failed');
    expect(r.connection.close).toHaveBeenCalledTimes(1);
  });
  it('can reconnect after an invalid resource fails to close', async () => {
    const first = resources();
    const next = resources();
    connect
      .mockResolvedValueOnce(first.connection)
      .mockResolvedValue(next.connection);
    first.connection.close.mockRejectedValue(new Error('cleanup failed'));
    const strategy = make();
    await strategy.emitAsync('a', {});
    first.channel.emit('close');
    await strategy.emitAsync('b', {});
    expect(next.channel.publish).toHaveBeenCalledTimes(1);
    await strategy.onModuleDestroy();
  });
  it('contains synchronous diagnostic throws', async () => {
    connect.mockRejectedValue(new Error('offline'));
    const diagnostic = jest.fn(() => {
      throw new Error('observer');
    });
    expect(make({ onBackgroundError: diagnostic }).emit('a', {})).toBe(true);
    await new Promise((resolve) => setImmediate(resolve));
    expect(diagnostic).toHaveBeenCalledTimes(1);
  });
  it('settles shutdown after a delayed connection failure without resurrection', async () => {
    const pending = deferred();
    connect.mockReturnValue(pending.promise);
    const strategy = make();
    const call = strategy.emitAsync('a', {});
    await new Promise((resolve) => setImmediate(resolve));
    const shutdown = strategy.onModuleDestroy();
    pending.reject(new Error('late connect failure'));
    await expect(call).rejects.toThrow('late connect failure');
    await shutdown;
    await expect(strategy.emitAsync('b', {})).rejects.toThrow('shut down');
    expect(connect).toHaveBeenCalledTimes(1);
  });
  it('bounds resource close waiting and tears down the underlying transport', async () => {
    jest.useFakeTimers();
    try {
      const r = resources();
      connect.mockResolvedValue(r.connection);
      const stream = { destroy: jest.fn() };
      const heartbeater = { clear: jest.fn() };
      Object.assign(r.connection, { connection: { stream, heartbeater } });
      r.channel.close.mockImplementation(() => new Promise(() => undefined));
      r.connection.close.mockImplementation(() => new Promise(() => undefined));
      const strategy = make();
      await strategy.emitAsync('a', {});
      const shutdown = strategy.onModuleDestroy();
      expect(strategy.onModuleDestroy()).toBe(shutdown);
      await jest.advanceTimersByTimeAsync(1000);
      await shutdown;
      expect(stream.destroy).toHaveBeenCalledTimes(1);
      expect(heartbeater.clear).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
