import { IEventStrategy } from '../context-event.interface.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClassType } from '@nestjs-yalc/types/globals.d.js';

export class NestLocalEventStrategy<
  P = any,
  O = any,
> implements IEventStrategy {
  constructor(private eventEmitter: EventEmitter2) {}

  emit(path: string, payload: P, options?: O): boolean {
    return this.eventEmitter.emit(path, payload, options);
  }

  emitAsync(path: string, payload: P, options?: O): Promise<any> {
    return this.eventEmitter.emitAsync(path, payload, options);
  }
}

export interface NestLocalEventStrategyProviderOptions {
  NestLocalStrategy?: ClassType<NestLocalEventStrategy>;
}

/**
 * Just a convenient provider to inject the NestLocalCallStrategy
 */
export const NestLocalEventStrategyProvider = (
  provide: string,
  options: NestLocalEventStrategyProviderOptions = {},
) => ({
  provide,
  useFactory: (eventEmitter: EventEmitter2) => {
    const _options = {
      baseUrl: '',
      NestLocalStrategy: NestLocalEventStrategy,
      ...options,
    };

    return new _options.NestLocalStrategy(eventEmitter);
  },
  inject: [EventEmitter2],
});
