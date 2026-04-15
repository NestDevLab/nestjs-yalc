import { DynamicModule, Module, Provider } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OmniExternalRefEntity } from './base/omni-external-ref.entity';
import { OmniNamedEntity } from './base/omni-named.entity';
import { OmniRecordEntity } from './base/omni-record.entity';
import { OmniRelationEntity } from './base/omni-relation.entity';
import { OmniCollectionEntity } from './omni-collection.entity';
import { omniCollectionBackendProvidersFactory } from './omni-collection.backend';
import { OmniDocumentEntity } from './omni-document.entity';
import { omniDocumentBackendProvidersFactory } from './omni-document.backend';
import { omniExternalRefBackendProvidersFactory } from './omni-external-ref.backend';
import { omniNamedBackendProvidersFactory } from './omni-named.backend';
import { omniRecordBackendProvidersFactory } from './omni-record.backend';
import { omniRelationBackendProvidersFactory } from './omni-relation.backend';
import {
  OmniKernelQueryService,
  omniKernelQueryServiceProviderFactory,
} from './omnikernel.query.service';

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
export class OmniKernelModule {
  static register(dbConnection: string): DynamicModule {
    const omniNamedProviders = bindGeneratedDataloaderEventEmitter(
      omniNamedBackendProvidersFactory(dbConnection).providers,
    );
    const omniRecordProviders = bindGeneratedDataloaderEventEmitter(
      omniRecordBackendProvidersFactory(dbConnection).providers,
    );
    const omniRelationProviders = bindGeneratedDataloaderEventEmitter(
      omniRelationBackendProvidersFactory(dbConnection).providers,
    );
    const omniCollectionProviders = bindGeneratedDataloaderEventEmitter(
      omniCollectionBackendProvidersFactory(dbConnection).providers,
    );
    const omniDocumentProviders = bindGeneratedDataloaderEventEmitter(
      omniDocumentBackendProvidersFactory(dbConnection).providers,
    );
    const omniExternalRefProviders = bindGeneratedDataloaderEventEmitter(
      omniExternalRefBackendProvidersFactory(dbConnection).providers,
    );
    const omniKernelQueryServiceProvider =
      omniKernelQueryServiceProviderFactory(dbConnection);
    const eventEmitter = new EventEmitter2();

    return {
      module: OmniKernelModule,
      imports: [
        TypeOrmModule.forFeature(
          [
            OmniNamedEntity,
            OmniRecordEntity,
            OmniRelationEntity,
            OmniCollectionEntity,
            OmniDocumentEntity,
            OmniExternalRefEntity,
          ],
          dbConnection,
        ),
      ],
      providers: [
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
        ...omniNamedProviders,
        ...omniRecordProviders,
        ...omniRelationProviders,
        ...omniCollectionProviders,
        ...omniDocumentProviders,
        ...omniExternalRefProviders,
        omniKernelQueryServiceProvider,
      ],
      exports: [
        EventEmitter2,
        ...omniNamedProviders,
        ...omniRecordProviders,
        ...omniRelationProviders,
        ...omniCollectionProviders,
        ...omniDocumentProviders,
        ...omniExternalRefProviders,
        omniKernelQueryServiceProvider,
        OmniKernelQueryService,
      ],
    };
  }
}
