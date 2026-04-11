import { CrudGenBackendFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
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
