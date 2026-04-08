import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import {
  OmniRelationCondition,
  OmniRelationCreateInput,
  OmniRelationType,
  OmniRelationUpdateInput,
} from './omni-relation.dto';
import { OmniRelationEntity } from './base/omni-relation.entity';

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
