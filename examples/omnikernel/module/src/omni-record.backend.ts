import { CrudGenBackendFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import { OmniRecordEntity } from './base/omni-record.entity';

export const omniRecordBackendProvidersFactory = (dbConnection: string) =>
  CrudGenBackendFactory<OmniRecordEntity>({
    entityModel: OmniRecordEntity,
    service: {
      dbConnection,
      entityModel: OmniRecordEntity,
    },
    dataloader: { databaseKey: 'guid' },
  });
