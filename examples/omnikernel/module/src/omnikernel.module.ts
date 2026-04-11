import { DynamicModule, Module } from '@nestjs/common';
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

@Module({})
export class OmniKernelModule {
  static register(dbConnection: string): DynamicModule {
    const omniNamedProviders = omniNamedBackendProvidersFactory(dbConnection);
    const omniRecordProviders = omniRecordBackendProvidersFactory(dbConnection);
    const omniRelationProviders =
      omniRelationBackendProvidersFactory(dbConnection);
    const omniCollectionProviders =
      omniCollectionBackendProvidersFactory(dbConnection);
    const omniDocumentProviders =
      omniDocumentBackendProvidersFactory(dbConnection);
    const omniExternalRefProviders =
      omniExternalRefBackendProvidersFactory(dbConnection);
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
