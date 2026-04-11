import {
  CrudGenBackendFactory,
  CrudGenDependencyFactory,
  CrudGenGraphqlFactory,
} from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import {
  OmniNamedCondition,
  OmniNamedCreateInput,
  OmniNamedType,
  OmniNamedUpdateInput,
} from './omni-named.dto';
import { OmniNamedEntity } from './base/omni-named.entity';

export const omniNamedBackendProvidersFactory = (dbConnection: string) =>
  CrudGenBackendFactory<OmniNamedEntity>({
    entityModel: OmniNamedEntity,
    service: {
      dbConnection,
      entityModel: OmniNamedEntity,
    },
    dataloader: { databaseKey: 'guid' },
  });

export const omniNamedGraphqlProvidersFactory = (
  tokens: { serviceToken?: string; dataLoaderToken?: string } = {},
) =>
  CrudGenGraphqlFactory<OmniNamedEntity>({
    entityModel: OmniNamedEntity,
    resolver: {
      dto: OmniNamedType,
      input: {
        create: OmniNamedCreateInput,
        update: OmniNamedUpdateInput,
        conditions: OmniNamedCondition,
      },
      prefix: 'OmniKernel_',
    },
    serviceToken: tokens.serviceToken,
    dataLoaderToken: tokens.dataLoaderToken,
  });

export const omniNamedProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<OmniNamedEntity>({
    entityModel: OmniNamedEntity,
    resolver: {
      dto: OmniNamedType,
      input: {
        create: OmniNamedCreateInput,
        update: OmniNamedUpdateInput,
        conditions: OmniNamedCondition,
      },
      prefix: 'OmniKernel_',
    },
    service: {
      dbConnection,
      entityModel: OmniNamedEntity,
    },
    dataloader: { databaseKey: 'guid' },
  });
