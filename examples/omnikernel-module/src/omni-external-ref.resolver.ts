import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import {
  OmniExternalRefCondition,
  OmniExternalRefCreateInput,
  OmniExternalRefType,
  OmniExternalRefUpdateInput,
} from './omni-external-ref.dto.js';
import { OmniExternalRefEntity } from './base/omni-external-ref.entity.js';

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
    },
    dataloader: { databaseKey: 'guid' },
  });
