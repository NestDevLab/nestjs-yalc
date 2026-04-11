import {
  CrudGenBackendFactory,
  CrudGenDependencyFactory,
  CrudGenGraphqlFactory,
} from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import {
  OmniExternalRefCondition,
  OmniExternalRefCreateInput,
  OmniExternalRefType,
  OmniExternalRefUpdateInput,
} from './omni-external-ref.dto';
import { OmniExternalRefEntity } from './base/omni-external-ref.entity';
import { OmniExternalRefService } from './omni-external-ref.service';

export const omniExternalRefBackendProvidersFactory = (dbConnection: string) =>
  CrudGenBackendFactory<OmniExternalRefEntity>({
    entityModel: OmniExternalRefEntity,
    service: {
      dbConnection,
      entityModel: OmniExternalRefEntity,
      providerClass: OmniExternalRefService,
    },
    dataloader: { databaseKey: 'guid' },
  });

export const omniExternalRefGraphqlProvidersFactory = (
  tokens: { serviceToken?: string; dataLoaderToken?: string } = {},
) =>
  CrudGenGraphqlFactory<OmniExternalRefEntity>({
    entityModel: OmniExternalRefEntity,
    resolver: {
      dto: OmniExternalRefType,
      input: {
        create: OmniExternalRefCreateInput,
        update: OmniExternalRefUpdateInput,
        conditions: OmniExternalRefCondition,
      },
      prefix: 'OmniKernel_',
    },
    serviceToken: tokens.serviceToken,
    dataLoaderToken: tokens.dataLoaderToken,
  });

export const omniExternalRefProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<OmniExternalRefEntity>({
    entityModel: OmniExternalRefEntity,
    resolver: {
      dto: OmniExternalRefType,
      input: {
        create: OmniExternalRefCreateInput,
        update: OmniExternalRefUpdateInput,
        conditions: OmniExternalRefCondition,
      },
      prefix: 'OmniKernel_',
    },
    service: {
      dbConnection,
      entityModel: OmniExternalRefEntity,
      providerClass: OmniExternalRefService,
    },
    dataloader: { databaseKey: 'guid' },
  });
