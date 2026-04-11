import {
  CrudGenBackendFactory,
  CrudGenDependencyFactory,
  CrudGenGraphqlFactory,
} from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import {
  OmniRelationCondition,
  OmniRelationCreateInput,
  OmniRelationType,
  OmniRelationUpdateInput,
} from './omni-relation.dto';
import { OmniRelationEntity } from './base/omni-relation.entity';

export const omniRelationBackendProvidersFactory = (dbConnection: string) =>
  CrudGenBackendFactory<OmniRelationEntity>({
    entityModel: OmniRelationEntity,
    service: {
      dbConnection,
      entityModel: OmniRelationEntity,
    },
    dataloader: { databaseKey: 'guid' },
  });

export const omniRelationGraphqlProvidersFactory = (
  tokens: { serviceToken?: string; dataLoaderToken?: string } = {},
) =>
  CrudGenGraphqlFactory<OmniRelationEntity>({
    entityModel: OmniRelationEntity,
    resolver: {
      dto: OmniRelationType,
      input: {
        create: OmniRelationCreateInput,
        update: OmniRelationUpdateInput,
        conditions: OmniRelationCondition,
      },
      prefix: 'OmniKernel_',
    },
    serviceToken: tokens.serviceToken,
    dataLoaderToken: tokens.dataLoaderToken,
  });

export const omniRelationProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<OmniRelationEntity>({
    entityModel: OmniRelationEntity,
    resolver: {
      dto: OmniRelationType,
      input: {
        create: OmniRelationCreateInput,
        update: OmniRelationUpdateInput,
        conditions: OmniRelationCondition,
      },
      prefix: 'OmniKernel_',
    },
    service: {
      dbConnection,
      entityModel: OmniRelationEntity,
    },
    dataloader: { databaseKey: 'guid' },
  });
