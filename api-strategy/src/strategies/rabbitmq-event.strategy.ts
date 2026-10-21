import { OnModuleDestroy } from '@nestjs/common';
import type { ClassType } from '@nestjs-yalc/types/globals.d.js';
import amqp, { Channel, ChannelModel, Options } from 'amqplib';
import { IEventStrategy } from '../context-event.interface.js';

interface RabbitConnectionResource {
  stream?: { destroy: () => void };
  heartbeater?: { clear: () => void };
}

interface RabbitSession {
  connection?: ChannelModel;
  channel?: Channel;
  invalid: boolean;
  disposal?: Promise<void>;
}

export interface RabbitMqEventStrategyOptions<P = any> {
  url: string;
  exchange: string;
  exchangeType?: string;
  durable?: boolean;
  persistent?: boolean;
  contentType?: string;
  publishOptions?: Options.Publish;
  serialize?: (payload: P) => Buffer | string;
  /** Observes background emit failures; diagnostics must not affect delivery. */
  onBackgroundError?: (error: unknown) => void | Promise<void>;
}

export class RabbitMqEventStrategy<P = any, O = any>
  implements IEventStrategy<P, boolean, O>, OnModuleDestroy
{
  private resource?: RabbitSession;
  private initialization?: Promise<Channel>;
  private cleanup: Promise<void> = Promise.resolve();
  private stopped = false;
  private destruction?: Promise<void>;

  constructor(private readonly options: RabbitMqEventStrategyOptions<P>) {}

  emit(path: string, payload: P): boolean {
    void this.publish(path, payload).catch(async (error: unknown) => {
      try {
        await this.options.onBackgroundError?.(error);
      } catch {
        // Diagnostics cannot turn fire-and-forget emission into an unhandled rejection.
      }
    });
    return true;
  }

  async emitAsync(path: string, payload: P): Promise<boolean> {
    return this.publish(path, payload);
  }

  onModuleDestroy(): Promise<void> {
    this.destruction ??= this.destroy();
    return this.destruction;
  }

  private async destroy() {
    this.stopped = true;
    await this.initialization?.catch(() => undefined);
    const resource = this.resource;
    this.resource = undefined;
    if (resource) {
      await this.dispose(resource);
    }
    await this.cleanup;
  }

  private async publish(path: string, payload: P) {
    const channel = await this.getChannel();
    if (this.stopped || this.resource?.channel !== channel) {
      throw new Error('RabbitMQ channel is no longer available.');
    }
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

  private async getChannel(): Promise<Channel> {
    if (this.stopped) {
      throw new Error('RabbitMqEventStrategy is shut down.');
    }
    if (this.initialization) {
      return this.initialization;
    }
    if (this.resource?.channel) {
      return this.resource.channel;
    }
    this.initialization = this.initialize();
    try {
      return await this.initialization;
    } finally {
      this.initialization = undefined;
    }
  }

  private async initialize(): Promise<Channel> {
    await this.cleanup;
    const resource: RabbitSession = { invalid: false };
    try {
      if (this.stopped) {
        throw new Error('RabbitMqEventStrategy is shut down.');
      }
      resource.connection = await amqp.connect(this.options.url);
      const invalidate = () => {
        resource.invalid = true;
        if (this.resource === resource) {
          this.resource = undefined;
          // No automatic reconnect or replay. The next explicit emit may reconnect.
          this.cleanup = this.dispose(resource).catch(() => undefined);
        }
      };
      resource.connection.on('error', invalidate);
      resource.connection.on('close', invalidate);
      resource.channel = await resource.connection.createChannel();
      resource.channel.on('error', invalidate);
      resource.channel.on('close', invalidate);
      await resource.channel.assertExchange(
        this.options.exchange,
        this.options.exchangeType ?? 'topic',
        { durable: this.options.durable ?? true },
      );
      if (resource.invalid || this.stopped) {
        throw new Error('RabbitMQ initialization interrupted.');
      }
      this.resource = resource;
      return resource.channel;
    } catch (error) {
      await this.dispose(resource).catch(() => undefined);
      throw error;
    }
  }

  private dispose(resource: RabbitSession): Promise<void> {
    resource.invalid = true;
    resource.disposal ??= (async () => {
      const results = await Promise.allSettled([
        closeRabbitResource(resource.channel),
        closeRabbitResource(resource.connection),
      ]);
      for (const result of results) {
        if (result.status === 'rejected') {
          throw result.reason;
        }
      }
    })();
    return resource.disposal;
  }
}

export interface RabbitMqEventStrategyProviderOptions<P = any> {
  RabbitMqStrategy?: ClassType<RabbitMqEventStrategy<P>>;
  options:
    | RabbitMqEventStrategyOptions<P>
    | (() => RabbitMqEventStrategyOptions<P>);
}

export const RabbitMqEventStrategyProvider = <P = any>(
  provide: string,
  options: RabbitMqEventStrategyProviderOptions<P>,
) => ({
  provide,
  useFactory: () => {
    const Strategy = options.RabbitMqStrategy ?? RabbitMqEventStrategy;
    const strategyOptions =
      typeof options.options === 'function'
        ? options.options()
        : options.options;

    return new Strategy(strategyOptions);
  },
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
