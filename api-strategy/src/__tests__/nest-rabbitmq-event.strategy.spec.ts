import { jest, beforeEach, describe, expect, it } from '@jest/globals';
import { createMock } from '@golevelup/ts-jest';
import { EventEmitter2 } from '@nestjs/event-emitter';

const publish = jest.fn(() => true);
const assertExchange = jest.fn();
const channelClose = jest.fn();
const connectionClose = jest.fn();
const createChannel = jest.fn();
const connect = jest.fn();

await jest.unstable_mockModule('amqplib', () => ({
  __esModule: true,
  default: {
    connect,
  },
}));

const {
  NestRabbitMqEventStrategy,
  NestRabbitMqEventStrategyProvider,
} = await import('../strategies/nest-rabbitmq-event.strategy.js');

describe('NestRabbitMqEventStrategy', () => {
  let eventEmitter: EventEmitter2;

  beforeEach(() => {
    jest.clearAllMocks();

    eventEmitter = createMock<EventEmitter2>({
      emit: jest.fn(() => true),
      emitAsync: jest.fn(() => Promise.resolve([])),
    });

    publish.mockReturnValue(true);
    assertExchange.mockResolvedValue(undefined as never);
    channelClose.mockResolvedValue(undefined as never);
    connectionClose.mockResolvedValue(undefined as never);
    createChannel.mockResolvedValue({
      assertExchange,
      publish,
      close: channelClose,
    } as never);
    connect.mockResolvedValue({
      createChannel,
      close: connectionClose,
    } as never);
  });

  it('emits locally and publishes to RabbitMQ asynchronously', async () => {
    const strategy = new NestRabbitMqEventStrategy(eventEmitter, {
      url: 'amqp://localhost',
      exchange: 'test.events',
    });

    const result = await strategy.emitAsync('task.created', { id: 'task-1' });

    expect(result).toBe(true);
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      'task.created',
      { id: 'task-1' },
      undefined,
    );
    expect(connect).toHaveBeenCalledWith('amqp://localhost');
    expect(assertExchange).toHaveBeenCalledWith('test.events', 'topic', {
      durable: true,
    });
    expect(publish).toHaveBeenCalledWith(
      'test.events',
      'task.created',
      Buffer.from(JSON.stringify({ id: 'task-1' })),
      {
        contentType: 'application/json',
        persistent: true,
      },
    );
  });

  it('uses custom broker options and buffer serialization', async () => {
    const body = Buffer.from('encoded');
    const strategy = new NestRabbitMqEventStrategy(eventEmitter, {
      url: 'amqp://localhost',
      exchange: 'test.events',
      exchangeType: 'fanout',
      durable: false,
      persistent: false,
      contentType: 'application/custom',
      publishOptions: {
        expiration: '1000',
      },
      serialize: () => body,
    });

    await strategy.emitAsync('task.created', { id: 'task-1' });

    expect(assertExchange).toHaveBeenCalledWith('test.events', 'fanout', {
      durable: false,
    });
    expect(publish).toHaveBeenCalledWith('test.events', 'task.created', body, {
      contentType: 'application/custom',
      persistent: false,
      expiration: '1000',
    });
  });

  it('reuses the open RabbitMQ channel', async () => {
    const strategy = new NestRabbitMqEventStrategy(eventEmitter, {
      url: 'amqp://localhost',
      exchange: 'test.events',
    });

    await strategy.emitAsync('task.created', { id: 'task-1' });
    await strategy.emitAsync('task.updated', { id: 'task-1' });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(createChannel).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('keeps sync emit local while publishing remotely in the background', async () => {
    const strategy = new NestRabbitMqEventStrategy(eventEmitter, {
      url: 'amqp://localhost',
      exchange: 'test.events',
    });

    const result = strategy.emit('task.created', { id: 'task-1' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result).toBe(true);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'task.created',
      { id: 'task-1' },
      undefined,
    );
    expect(publish).toHaveBeenCalled();
  });

  it('does not fail sync emit when background publishing fails', async () => {
    const strategy = new NestRabbitMqEventStrategy(eventEmitter, {
      url: 'amqp://localhost',
      exchange: 'test.events',
    });
    connect.mockRejectedValueOnce(new Error('publish failed') as never);

    const result = strategy.emit('task.created', { id: 'task-1' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result).toBe(true);
    expect(eventEmitter.emit).toHaveBeenCalled();
  });

  it('closes RabbitMQ resources on module destroy', async () => {
    const strategy = new NestRabbitMqEventStrategy(eventEmitter, {
      url: 'amqp://localhost',
      exchange: 'test.events',
    });

    await strategy.emitAsync('task.created', { id: 'task-1' });
    await strategy.onModuleDestroy();

    expect(channelClose).toHaveBeenCalled();
    expect(connectionClose).toHaveBeenCalled();
  });

  it('ignores closing errors on module destroy', async () => {
    const strategy = new NestRabbitMqEventStrategy(eventEmitter, {
      url: 'amqp://localhost',
      exchange: 'test.events',
    });
    channelClose.mockRejectedValue(new Error('already closing') as never);
    connectionClose.mockRejectedValue(new Error('connection closing') as never);

    await strategy.emitAsync('task.created', { id: 'task-1' });

    await expect(strategy.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('throws unexpected close errors on module destroy', async () => {
    const strategy = new NestRabbitMqEventStrategy(eventEmitter, {
      url: 'amqp://localhost',
      exchange: 'test.events',
    });
    channelClose.mockRejectedValue(new Error('boom') as never);

    await strategy.emitAsync('task.created', { id: 'task-1' });

    await expect(strategy.onModuleDestroy()).rejects.toThrow('boom');
  });

  it('does not close RabbitMQ resources before a connection is opened', async () => {
    const strategy = new NestRabbitMqEventStrategy(eventEmitter, {
      url: 'amqp://localhost',
      exchange: 'test.events',
    });

    await strategy.onModuleDestroy();

    expect(channelClose).not.toHaveBeenCalled();
    expect(connectionClose).not.toHaveBeenCalled();
  });

  it('creates a provider', () => {
    const provider = NestRabbitMqEventStrategyProvider('test', {
      options: {
        url: 'amqp://localhost',
        exchange: 'test.events',
      },
    });

    expect(provider).toBeDefined();
    expect(provider.useFactory(eventEmitter)).toBeDefined();
  });

  it('creates a provider with an options factory', () => {
    const provider = NestRabbitMqEventStrategyProvider('test', {
      options: () => ({
        url: 'amqp://localhost',
        exchange: 'test.events',
      }),
    });

    expect(provider.useFactory(eventEmitter)).toBeDefined();
  });
});
