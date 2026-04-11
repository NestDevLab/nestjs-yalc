import { CrudGenBackendFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
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
