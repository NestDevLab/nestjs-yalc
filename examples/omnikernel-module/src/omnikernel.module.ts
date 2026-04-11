import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OmniExternalRefEntity } from './base/omni-external-ref.entity';
import { OmniNamedEntity } from './base/omni-named.entity';
import { OmniRecordEntity } from './base/omni-record.entity';
import { OmniRelationEntity } from './base/omni-relation.entity';
import { OmniCollectionEntity } from './omni-collection.entity';
import {
  omniCollectionBackendProvidersFactory,
  omniCollectionGraphqlProvidersFactory,
} from './omni-collection.resolver';
import { OmniDocumentEntity } from './omni-document.entity';
import {
  omniDocumentBackendProvidersFactory,
  omniDocumentGraphqlProvidersFactory,
} from './omni-document.resolver';
import {
  omniExternalRefBackendProvidersFactory,
  omniExternalRefGraphqlProvidersFactory,
} from './omni-external-ref.resolver';
import {
  omniNamedBackendProvidersFactory,
  omniNamedGraphqlProvidersFactory,
} from './omni-named.resolver';
import {
  omniRecordBackendProvidersFactory,
  omniRecordGraphqlProvidersFactory,
} from './omni-record.resolver';
import {
  omniRelationBackendProvidersFactory,
  omniRelationGraphqlProvidersFactory,
} from './omni-relation.resolver';
import {
  OmniKernelQueryService,
  omniKernelQueryServiceProviderFactory,
} from './omnikernel.query.service';

export interface OmniKernelModuleOptions {
  graphql?: boolean;
}

@Module({})
export class OmniKernelModule {
  static register(
    dbConnection: string,
    options: OmniKernelModuleOptions = {},
  ): DynamicModule {
    const includeGraphql = options.graphql ?? true;
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
    const graphqlProviders = includeGraphql
      ? [
          ...omniNamedGraphqlProvidersFactory(omniNamedProviders).providers,
          ...omniRecordGraphqlProvidersFactory(omniRecordProviders).providers,
          ...omniRelationGraphqlProvidersFactory(omniRelationProviders)
            .providers,
          ...omniCollectionGraphqlProvidersFactory(omniCollectionProviders)
            .providers,
          ...omniDocumentGraphqlProvidersFactory(omniDocumentProviders)
            .providers,
          ...omniExternalRefGraphqlProvidersFactory(omniExternalRefProviders)
            .providers,
        ]
      : [];

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
        ...graphqlProviders,
        omniKernelQueryServiceProvider,
      ],
      exports: [
        ...omniNamedProviders.providers,
        ...omniRecordProviders.providers,
        ...omniRelationProviders.providers,
        ...omniCollectionProviders.providers,
        ...omniDocumentProviders.providers,
        ...omniExternalRefProviders.providers,
        ...graphqlProviders,
        omniKernelQueryServiceProvider,
        OmniKernelQueryService,
      ],
    };
  }
}
