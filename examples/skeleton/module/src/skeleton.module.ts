import { DynamicModule, Module, Provider } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { skeletonUserProvidersFactory } from './skeleton-user.resolver.js';
import { skeletonPhoneProvidersFactory } from './skeleton-phone.resolver.js';
import { SkeletonPhone } from './skeleton-phone.entity.js';
import { SkeletonUser } from './skeleton-user.entity.js';

type ProviderWithInject = Provider & { inject?: unknown[] };

const bindGeneratedDataloaderEventEmitter = (
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

@Module({})
export class SkeletonModule {
  static register(dbConnection: string): DynamicModule {
    const skeletonPhoneProviders = bindGeneratedDataloaderEventEmitter(
      skeletonPhoneProvidersFactory(dbConnection).providers,
    );
    const skeletonUserProviders = bindGeneratedDataloaderEventEmitter(
      skeletonUserProvidersFactory(dbConnection).providers,
    );
    const eventEmitter = new EventEmitter2();

    return {
      module: SkeletonModule,
      imports: [
        TypeOrmModule.forFeature([SkeletonPhone, SkeletonUser], dbConnection),
      ],
      providers: [
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
        ...skeletonPhoneProviders,
        ...skeletonUserProviders,
      ],
      exports: [
        EventEmitter2,
        ...skeletonPhoneProviders,
        ...skeletonUserProviders,
      ],
    };
  }
}
