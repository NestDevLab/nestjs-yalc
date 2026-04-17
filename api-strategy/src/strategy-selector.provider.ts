import type { Provider } from '@nestjs/common';
import type { IApiCallStrategy } from './context-call.interface.js';
import type { IEventStrategy } from './context-event.interface.js';

export type StrategySelectorToken<TStrategy = unknown> =
  | string
  | symbol
  | (abstract new (...args: any[]) => TStrategy)
  | (new (...args: any[]) => TStrategy);

export type StrategySelectorBehavior = 'throw' | 'fallback';

export interface StrategySelectorFactoryOptions {
  inject?: any[];
  useFactory?: (
    ...args: any[]
  ) => string | null | undefined | Promise<string | null | undefined>;
}

export interface StrategySelectorProviderOptions<TStrategy> {
  provide: StrategySelectorToken<TStrategy>;
  defaultStrategy: string;
  strategies: Record<string, StrategySelectorToken<TStrategy>>;
  selector?: StrategySelectorFactoryOptions;
  unknownStrategyBehavior?: StrategySelectorBehavior;
}

function normalizeStrategyKey(strategy: string | null | undefined) {
  const value = strategy?.trim();
  return value ? value : undefined;
}

export function StrategySelectorProvider<TStrategy>(
  options: StrategySelectorProviderOptions<TStrategy>,
): Provider<TStrategy> {
  const strategyEntries = Object.entries(options.strategies);

  if (strategyEntries.length === 0) {
    throw new Error('Strategy selector requires at least one strategy.');
  }

  const defaultStrategyIndex = strategyEntries.findIndex(
    ([key]) => key === options.defaultStrategy,
  );

  if (defaultStrategyIndex < 0) {
    throw new Error(
      `Default strategy "${options.defaultStrategy}" is not registered.`,
    );
  }

  const behavior = options.unknownStrategyBehavior ?? 'throw';
  const selectorInject = options.selector?.inject ?? [];

  return {
    provide: options.provide,
    useFactory: async (...args: any[]) => {
      const strategyInstances = args.slice(
        0,
        strategyEntries.length,
      ) as TStrategy[];
      const selectorArgs = args.slice(strategyEntries.length);
      const configuredStrategy = normalizeStrategyKey(
        await options.selector?.useFactory?.(...selectorArgs),
      );
      const selectedStrategy = configuredStrategy ?? options.defaultStrategy;
      const selectedStrategyIndex = strategyEntries.findIndex(
        ([key]) => key === selectedStrategy,
      );

      if (selectedStrategyIndex >= 0) {
        return strategyInstances[selectedStrategyIndex];
      }

      if (behavior === 'fallback') {
        return strategyInstances[defaultStrategyIndex];
      }

      const availableStrategies = strategyEntries
        .map(([key]) => key)
        .join(', ');
      throw new Error(
        `Unknown strategy "${selectedStrategy}". Available strategies: ${availableStrategies}.`,
      );
    },
    inject: [
      ...strategyEntries.map(([, strategyToken]) => strategyToken),
      ...selectorInject,
    ],
  };
}

export function ApiCallStrategySelectorProvider(
  options: StrategySelectorProviderOptions<IApiCallStrategy>,
): Provider<IApiCallStrategy> {
  return StrategySelectorProvider(options);
}

export function EventStrategySelectorProvider(
  options: StrategySelectorProviderOptions<IEventStrategy>,
): Provider<IEventStrategy> {
  return StrategySelectorProvider(options);
}
