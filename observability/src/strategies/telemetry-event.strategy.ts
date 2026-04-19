import { OnModuleDestroy } from '@nestjs/common';
import type { IEventStrategy } from '@nestjs-yalc/api-strategy/context-event.interface.js';
import { TelemetryService } from '../telemetry.service.js';

export interface TelemetryEventStrategyOptions {
  name: string;
  transport?: string;
}

export class TelemetryEventStrategy<P = any, R = any, O = any>
  implements IEventStrategy<P, R, O>, OnModuleDestroy
{
  constructor(
    private readonly strategy: IEventStrategy<P, R, O>,
    private readonly telemetry: TelemetryService,
    private readonly options: TelemetryEventStrategyOptions,
  ) {}

  emit(path: string, payload: P, options?: O): R {
    return this.telemetry.measure(
      `event-strategy.${this.options.name}.emit`,
      () => this.strategy.emit(path, payload, options),
      this.attributes('emit', path),
    ) as R;
  }

  emitAsync(path: string, payload: P, options?: O): Promise<R> {
    return this.telemetry.measure(
      `event-strategy.${this.options.name}.emitAsync`,
      () => this.strategy.emitAsync(path, payload, options),
      this.attributes('emitAsync', path),
    ) as Promise<R>;
  }

  async onModuleDestroy() {
    const destroyable = this.strategy as Partial<OnModuleDestroy>;

    if (typeof destroyable.onModuleDestroy === 'function') {
      await destroyable.onModuleDestroy();
    }
  }

  private attributes(operation: string, path: string) {
    return {
      'yalc.strategy.kind': 'event',
      'yalc.strategy.name': this.options.name,
      'yalc.strategy.transport': this.options.transport,
      'yalc.strategy.operation': operation,
      'yalc.strategy.path': path,
    };
  }
}
