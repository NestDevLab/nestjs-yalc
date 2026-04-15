import { Provider } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

type ProviderWithInject = Provider & { inject?: unknown[] };

export const bindGeneratedDataloaderEventEmitter = (
  providers: Provider[],
): Provider[] =>
  providers.map((provider) => {
    if (typeof provider !== 'object' || provider === null) return provider;

    const providerWithInject = provider as ProviderWithInject;
    if (!Array.isArray(providerWithInject.inject)) return provider;

    return {
      ...providerWithInject,
      inject: providerWithInject.inject.map((token) => token ?? EventEmitter2),
    } as Provider;
  });
