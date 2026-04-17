import { describe, expect, it } from '@jest/globals';
import type { IApiCallStrategy } from '../context-call.interface.js';
import type { IEventStrategy } from '../context-event.interface.js';
import {
  ApiCallStrategySelectorProvider,
  EventStrategySelectorProvider,
  StrategySelectorProvider,
} from '../strategy-selector.provider.js';

describe('StrategySelectorProvider', () => {
  const localStrategy = { name: 'local' };
  const remoteStrategy = { name: 'remote' };

  it('should create a provider with strategy tokens before selector tokens', () => {
    const provider = StrategySelectorProvider({
      provide: 'SELECTED_STRATEGY',
      defaultStrategy: 'local',
      strategies: {
        local: 'LOCAL_STRATEGY',
        remote: 'REMOTE_STRATEGY',
      },
      selector: {
        inject: ['CONFIG'],
        useFactory: () => 'remote',
      },
    });

    expect(provider).toMatchObject({
      provide: 'SELECTED_STRATEGY',
      inject: ['LOCAL_STRATEGY', 'REMOTE_STRATEGY', 'CONFIG'],
    });
  });

  it('should resolve the default strategy when selector is not configured', async () => {
    const provider = StrategySelectorProvider({
      provide: 'SELECTED_STRATEGY',
      defaultStrategy: 'local',
      strategies: {
        local: 'LOCAL_STRATEGY',
        remote: 'REMOTE_STRATEGY',
      },
    });

    await expect(
      (provider as any).useFactory(localStrategy, remoteStrategy),
    ).resolves.toBe(localStrategy);
  });

  it('should resolve the configured strategy from selector args', async () => {
    const provider = StrategySelectorProvider({
      provide: 'SELECTED_STRATEGY',
      defaultStrategy: 'local',
      strategies: {
        local: 'LOCAL_STRATEGY',
        remote: 'REMOTE_STRATEGY',
      },
      selector: {
        inject: ['CONFIG'],
        useFactory: (config: { strategy: string }) => config.strategy,
      },
    });

    await expect(
      (provider as any).useFactory(localStrategy, remoteStrategy, {
        strategy: 'remote',
      }),
    ).resolves.toBe(remoteStrategy);
  });

  it('should trim empty selector results and use the default strategy', async () => {
    const provider = StrategySelectorProvider({
      provide: 'SELECTED_STRATEGY',
      defaultStrategy: 'local',
      strategies: {
        local: 'LOCAL_STRATEGY',
        remote: 'REMOTE_STRATEGY',
      },
      selector: {
        useFactory: () => '   ',
      },
    });

    await expect(
      (provider as any).useFactory(localStrategy, remoteStrategy),
    ).resolves.toBe(localStrategy);
  });

  it('should throw when selected strategy is unknown by default', async () => {
    const provider = StrategySelectorProvider({
      provide: 'SELECTED_STRATEGY',
      defaultStrategy: 'local',
      strategies: {
        local: 'LOCAL_STRATEGY',
      },
      selector: {
        useFactory: () => 'missing',
      },
    });

    await expect((provider as any).useFactory(localStrategy)).rejects.toThrow(
      'Unknown strategy "missing"',
    );
  });

  it('should fall back to default when configured to fallback on unknown strategies', async () => {
    const provider = StrategySelectorProvider({
      provide: 'SELECTED_STRATEGY',
      defaultStrategy: 'local',
      strategies: {
        local: 'LOCAL_STRATEGY',
        remote: 'REMOTE_STRATEGY',
      },
      selector: {
        useFactory: () => 'missing',
      },
      unknownStrategyBehavior: 'fallback',
    });

    await expect(
      (provider as any).useFactory(localStrategy, remoteStrategy),
    ).resolves.toBe(localStrategy);
  });

  it('should throw when no strategies are registered', () => {
    expect(() =>
      StrategySelectorProvider({
        provide: 'SELECTED_STRATEGY',
        defaultStrategy: 'local',
        strategies: {},
      }),
    ).toThrow('at least one strategy');
  });

  it('should throw when default strategy is not registered', () => {
    expect(() =>
      StrategySelectorProvider({
        provide: 'SELECTED_STRATEGY',
        defaultStrategy: 'local',
        strategies: {
          remote: 'REMOTE_STRATEGY',
        },
      }),
    ).toThrow('Default strategy "local" is not registered');
  });

  it('should expose a typed api call strategy selector provider', async () => {
    const apiStrategy = {
      call: async () => ({}),
      get: async () => ({}),
      post: async () => ({}),
    } satisfies IApiCallStrategy;
    const provider = ApiCallStrategySelectorProvider({
      provide: 'API_STRATEGY',
      defaultStrategy: 'local',
      strategies: {
        local: 'LOCAL_API_STRATEGY',
      },
    });

    await expect((provider as any).useFactory(apiStrategy)).resolves.toBe(
      apiStrategy,
    );
  });

  it('should expose a typed event strategy selector provider', async () => {
    const eventStrategy = {
      emit: () => true,
      emitAsync: async () => true,
    } satisfies IEventStrategy;
    const provider = EventStrategySelectorProvider({
      provide: 'EVENT_STRATEGY',
      defaultStrategy: 'local',
      strategies: {
        local: 'LOCAL_EVENT_STRATEGY',
      },
    });

    await expect((provider as any).useFactory(eventStrategy)).resolves.toBe(
      eventStrategy,
    );
  });
});
