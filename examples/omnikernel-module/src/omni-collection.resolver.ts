import {
  CrudGenBackendFactory,
  CrudGenDependencyFactory,
  CrudGenGraphqlFactory,
} from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import {
  OmniCollectionCondition,
  OmniCollectionCreateInput,
  OmniCollectionType,
  OmniCollectionUpdateInput,
} from './omni-collection.dto';
import { OmniCollectionEntity } from './omni-collection.entity';
import { OmniCollectionService } from './omni-collection.service';

export const omniCollectionBackendProvidersFactory = (dbConnection: string) =>
  CrudGenBackendFactory<OmniCollectionEntity>({
    entityModel: OmniCollectionEntity,
    service: {
      dbConnection,
      entityModel: OmniCollectionEntity,
      providerClass: OmniCollectionService,
    },
    dataloader: { databaseKey: 'guid' },
  });

export const omniCollectionGraphqlProvidersFactory = (
  tokens: { serviceToken?: string; dataLoaderToken?: string } = {},
) =>
  CrudGenGraphqlFactory<OmniCollectionEntity>({
    entityModel: OmniCollectionEntity,
    resolver: {
      dto: OmniCollectionType,
      input: {
        create: OmniCollectionCreateInput,
        update: OmniCollectionUpdateInput,
        conditions: OmniCollectionCondition,
      },
      prefix: 'OmniKernel_',
    },
    serviceToken: tokens.serviceToken,
    dataLoaderToken: tokens.dataLoaderToken,
  });

export const omniCollectionProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<OmniCollectionEntity>({
    entityModel: OmniCollectionEntity,
    resolver: {
      dto: OmniCollectionType,
      input: {
        create: OmniCollectionCreateInput,
        update: OmniCollectionUpdateInput,
        conditions: OmniCollectionCondition,
      },
      prefix: 'OmniKernel_',
    },
    service: {
      dbConnection,
      entityModel: OmniCollectionEntity,
      providerClass: OmniCollectionService,
    },
    dataloader: { databaseKey: 'guid' },
  });
