import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import {
  OmniCollectionCondition,
  OmniCollectionCreateInput,
  OmniCollectionType,
  OmniCollectionUpdateInput,
} from './omni-collection.dto.js';
import { OmniCollectionEntity } from './omni-collection.entity.js';
import { OmniCollectionService } from './omni-collection.service.js';

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
