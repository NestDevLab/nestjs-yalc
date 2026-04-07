import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import {
  OmniRelationCondition,
  OmniRelationCreateInput,
  OmniRelationType,
  OmniRelationUpdateInput,
} from './omni-relation.dto.js';
import { OmniRelationEntity } from './base/omni-relation.entity.js';

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
