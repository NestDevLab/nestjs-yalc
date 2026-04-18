import { OnModuleDestroy } from '@nestjs/common';
import type { IEventStrategy } from '../context-event.interface.js';

export type CompositeEventStrategyErrorMode = 'throw' | 'ignore';

export interface CompositeEventStrategyOptions {
  errorMode?: CompositeEventStrategyErrorMode;
}

export class CompositeEventStrategy<P = any, R = any, O = any>
  implements IEventStrategy<P, R[], O>, OnModuleDestroy
{
  private readonly errorMode: CompositeEventStrategyErrorMode;

  constructor(
    private readonly strategies: IEventStrategy<P, R, O>[],
    options: CompositeEventStrategyOptions = {},
  ) {
    if (strategies.length === 0) {
      throw new Error('CompositeEventStrategy requires at least one strategy.');
    }

    this.errorMode = options.errorMode ?? 'throw';
  }

  emit(path: string, payload: P, options?: O): R[] {
    const results: R[] = [];

    for (const strategy of this.strategies) {
      try {
        results.push(strategy.emit(path, payload, options));
      } catch (error) {
        if (this.errorMode === 'throw') {
          throw error;
        }
      }
    }

    return results;
  }

  async emitAsync(path: string, payload: P, options?: O): Promise<R[]> {
    const settled = await Promise.allSettled(
      this.strategies.map((strategy) =>
        strategy.emitAsync(path, payload, options),
      ),
    );
    const results: R[] = [];

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else if (this.errorMode === 'throw') {
        throw result.reason;
      }
    }

    return results;
  }

  async onModuleDestroy() {
    await Promise.all(
      this.strategies.map(async (strategy) => {
        await maybeDestroyStrategy(strategy);
      }),
    );
  }
}

async function maybeDestroyStrategy(strategy: unknown) {
  const destroyable = strategy as Partial<OnModuleDestroy>;

  if (typeof destroyable.onModuleDestroy === 'function') {
    await destroyable.onModuleDestroy();
  }
}
