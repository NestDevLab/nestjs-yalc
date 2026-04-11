import { CrudGenBackendFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
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
