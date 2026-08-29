import { DynamicModule, Module, Provider } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OmniExternalRefEntity } from './base/omni-external-ref.entity.js';
import { OmniNamedEntity } from './base/omni-named.entity.js';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import { OmniRelationEntity } from './base/omni-relation.entity.js';
import { OmniCollectionEntity } from './omni-collection.entity.js';
import { omniCollectionBackendProvidersFactory } from './omni-collection.backend.js';
import { OmniDocumentEntity } from './omni-document.entity.js';
import { omniDocumentBackendProvidersFactory } from './omni-document.backend.js';
import { omniExternalRefBackendProvidersFactory } from './omni-external-ref.backend.js';
import { omniNamedBackendProvidersFactory } from './omni-named.backend.js';
import { omniRecordBackendProvidersFactory } from './omni-record.backend.js';
import { omniRelationBackendProvidersFactory } from './omni-relation.backend.js';
import {
  OmniKernelQueryService,
  omniKernelQueryServiceProviderFactory,
} from './omnikernel.query.service.js';
import {
  OMNI_KERNEL_OPTIONS,
  OmniScopeContext,
  normalizeOmniKernelRegistrationOptions,
  type OmniKernelRegistrationOptions,
} from './omni-scope.js';

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
  static register(
    registration: string | OmniKernelRegistrationOptions,
  ): DynamicModule {
    const options = normalizeOmniKernelRegistrationOptions(registration);
    const { dbConnection } = options;
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
        { provide: OMNI_KERNEL_OPTIONS, useValue: options },
        OmniScopeContext,
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
        OmniScopeContext,
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
