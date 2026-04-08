import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OmniExternalRefEntity } from './base/omni-external-ref.entity';
import { OmniNamedEntity } from './base/omni-named.entity';
import { OmniRecordEntity } from './base/omni-record.entity';
import { OmniRelationEntity } from './base/omni-relation.entity';
import { OmniCollectionEntity } from './omni-collection.entity';
import { omniCollectionProvidersFactory } from './omni-collection.resolver';
import { OmniDocumentEntity } from './omni-document.entity';
import { omniDocumentProvidersFactory } from './omni-document.resolver';
import { omniExternalRefProvidersFactory } from './omni-external-ref.resolver';
import { omniNamedProvidersFactory } from './omni-named.resolver';
import { omniRecordProvidersFactory } from './omni-record.resolver';
import { omniRelationProvidersFactory } from './omni-relation.resolver';
import {
  OmniKernelQueryService,
  omniKernelQueryServiceProviderFactory,
} from './omnikernel.query.service';

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
