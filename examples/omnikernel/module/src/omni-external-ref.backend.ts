import { CrudGenBackendFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
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
