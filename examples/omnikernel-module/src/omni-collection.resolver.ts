import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import {
  OmniCollectionCondition,
  OmniCollectionCreateInput,
  OmniCollectionType,
  OmniCollectionUpdateInput,
} from './omni-collection.dto';
import { OmniCollectionEntity } from './omni-collection.entity';
import { OmniCollectionService } from './omni-collection.service';

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
