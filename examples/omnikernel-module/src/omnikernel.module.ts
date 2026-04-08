import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OmniExternalRefEntity } from './base/omni-external-ref.entity.js';
import { OmniNamedEntity } from './base/omni-named.entity.js';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import { OmniRelationEntity } from './base/omni-relation.entity.js';
import { OmniCollectionEntity } from './omni-collection.entity.js';
import { omniCollectionProvidersFactory } from './omni-collection.resolver.js';
import { OmniDocumentEntity } from './omni-document.entity.js';
import { omniDocumentProvidersFactory } from './omni-document.resolver.js';
import { omniExternalRefProvidersFactory } from './omni-external-ref.resolver.js';
import { omniNamedProvidersFactory } from './omni-named.resolver.js';
import { omniRecordProvidersFactory } from './omni-record.resolver.js';
import { omniRelationProvidersFactory } from './omni-relation.resolver.js';
import {
  OmniKernelQueryService,
  omniKernelQueryServiceProviderFactory,
} from './omnikernel.query.service.js';

@Module({})
export class OmniKernelModule {
  static register(dbConnection: string): DynamicModule {
    const omniNamedProviders = omniNamedProvidersFactory(dbConnection);
    const omniRecordProviders = omniRecordProvidersFactory(dbConnection);
    const omniRelationProviders = omniRelationProvidersFactory(dbConnection);
    const omniCollectionProviders =
      omniCollectionProvidersFactory(dbConnection);
    const omniDocumentProviders = omniDocumentProvidersFactory(dbConnection);
    const omniExternalRefProviders =
      omniExternalRefProvidersFactory(dbConnection);
    const omniKernelQueryServiceProvider =
      omniKernelQueryServiceProviderFactory(dbConnection);

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
        ...omniNamedProviders.providers,
        ...omniRecordProviders.providers,
        ...omniRelationProviders.providers,
        ...omniCollectionProviders.providers,
        ...omniDocumentProviders.providers,
        ...omniExternalRefProviders.providers,
        omniKernelQueryServiceProvider,
      ],
      exports: [
        ...omniNamedProviders.providers,
        ...omniRecordProviders.providers,
        ...omniRelationProviders.providers,
        ...omniCollectionProviders.providers,
        ...omniDocumentProviders.providers,
        ...omniExternalRefProviders.providers,
        omniKernelQueryServiceProvider,
        OmniKernelQueryService,
      ],
    };
  }
}
