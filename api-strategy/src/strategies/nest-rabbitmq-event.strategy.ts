import { OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ClassType } from '@nestjs-yalc/types/globals.d.js';
import amqp, { Channel, ChannelModel, Options } from 'amqplib';
import { IEventStrategy } from '../context-event.interface.js';

interface RabbitConnectionResource {
  stream?: { destroy: () => void };
  heartbeater?: { clear: () => void };
}

export interface NestRabbitMqEventStrategyOptions<P = any> {
  url: string;
  exchange: string;
  exchangeType?: string;
  durable?: boolean;
  persistent?: boolean;
  contentType?: string;
  publishOptions?: Options.Publish;
  serialize?: (payload: P) => Buffer | string;
}

export class NestRabbitMqEventStrategy<P = any, O = any>
  implements IEventStrategy<P, boolean, O>, OnModuleDestroy
{
  private connection?: ChannelModel;
  private channel?: Channel;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly options: NestRabbitMqEventStrategyOptions<P>,
  ) {}

  emit(path: string, payload: P, options?: O): boolean {
    const localResult = this.eventEmitter.emit(path, payload, options);

    void this.publish(path, payload).catch(() => undefined);

    return localResult;
  }

  async emitAsync(path: string, payload: P, options?: O): Promise<boolean> {
    await Promise.all([
      this.eventEmitter.emitAsync(path, payload, options),
      this.publish(path, payload),
    ]);

    return true;
  }

  async onModuleDestroy() {
    await closeRabbitResource(this.channel);
    await closeRabbitResource(this.connection);
    this.channel = undefined;
    this.connection = undefined;
  }

  private async publish(path: string, payload: P) {
    const channel = await this.getChannel();
    const body = this.serialize(payload);

    return channel.publish(this.options.exchange, path, body, {
      contentType: this.options.contentType ?? 'application/json',
      persistent: this.options.persistent ?? true,
      ...this.options.publishOptions,
    });
  }

  private serialize(payload: P) {
    const serialized = this.options.serialize?.(payload);

    if (Buffer.isBuffer(serialized)) {
      return serialized;
    }

    return Buffer.from(serialized ?? JSON.stringify(payload));
  }

  private async getChannel() {
    if (this.channel) {
      return this.channel;
    }

    this.connection = await amqp.connect(this.options.url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(
      this.options.exchange,
      this.options.exchangeType ?? 'topic',
      {
        durable: this.options.durable ?? true,
      },
    );

    return this.channel;
  }
}

export interface NestRabbitMqEventStrategyProviderOptions<P = any> {
  NestRabbitMqStrategy?: ClassType<NestRabbitMqEventStrategy<P>>;
  options:
    | NestRabbitMqEventStrategyOptions<P>
    | ((eventEmitter: EventEmitter2) => NestRabbitMqEventStrategyOptions<P>);
}

export const NestRabbitMqEventStrategyProvider = <P = any>(
  provide: string,
  options: NestRabbitMqEventStrategyProviderOptions<P>,
) => ({
  provide,
  useFactory: (eventEmitter: EventEmitter2) => {
    const RabbitMqStrategy =
      options.NestRabbitMqStrategy ?? NestRabbitMqEventStrategy;
    const strategyOptions =
      typeof options.options === 'function'
        ? options.options(eventEmitter)
        : options.options;

    return new RabbitMqStrategy(eventEmitter, strategyOptions);
  },
  inject: [EventEmitter2],
});

async function closeRabbitResource(resource?: {
  close: () => Promise<void>;
  connection?: unknown;
  stream?: { destroy: () => void };
  heartbeater?: { clear: () => void };
}) {
  if (!resource) {
    return;
  }

  let timeout: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      resource.close(),
      new Promise((resolve) => {
        timeout = setTimeout(resolve, 1000);
      }),
    ]);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('closing')) {
      throw error;
    }
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }

    forceCloseRabbitResource(resource);
  }
}

function forceCloseRabbitResource(resource: {
  connection?: unknown;
  stream?: { destroy: () => void };
  heartbeater?: { clear: () => void };
}) {
  const connection = resource.connection as
    | RabbitConnectionResource
    | undefined;

  connection?.heartbeater?.clear();
  resource.heartbeater?.clear();
  connection?.stream?.destroy();
  resource.stream?.destroy();
}
