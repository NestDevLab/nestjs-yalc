import { OnModuleDestroy } from '@nestjs/common';
import type { IEventStrategy } from '../context-event.interface.js';

export interface ConditionalEventStrategyOptions<P = any, R = any, O = any> {
  enabled?: boolean | (() => boolean);
  shouldEmit?: (path: string, payload: P, options?: O) => boolean;
  disabledResult?: R;
}

export class ConditionalEventStrategy<P = any, R = any, O = any>
  implements IEventStrategy<P, R, O>, OnModuleDestroy
{
  constructor(
    private readonly strategy: IEventStrategy<P, R, O>,
    private readonly options: ConditionalEventStrategyOptions<P, R, O> = {},
  ) {}

  emit(path: string, payload: P, options?: O): R {
    if (!this.shouldRun(path, payload, options)) {
      return this.options.disabledResult as R;
    }

    return this.strategy.emit(path, payload, options);
  }

  async emitAsync(path: string, payload: P, options?: O): Promise<R> {
    if (!this.shouldRun(path, payload, options)) {
      return this.options.disabledResult as R;
    }

    return this.strategy.emitAsync(path, payload, options);
  }

  async onModuleDestroy() {
    const destroyable = this.strategy as Partial<OnModuleDestroy>;

    if (typeof destroyable.onModuleDestroy === 'function') {
      await destroyable.onModuleDestroy();
    }
  }

  private shouldRun(path: string, payload: P, options?: O) {
    const enabled =
      typeof this.options.enabled === 'function'
        ? this.options.enabled()
        : this.options.enabled;

    if (enabled === false) {
      return false;
    }

    return this.options.shouldEmit?.(path, payload, options) ?? true;
  }
}
