import { CrudGenBackendFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import { OmniDocumentEntity } from './omni-document.entity';
import { OmniDocumentService } from './omni-document.service';

export const omniDocumentBackendProvidersFactory = (dbConnection: string) =>
  CrudGenBackendFactory<OmniDocumentEntity>({
    entityModel: OmniDocumentEntity,
    service: {
      dbConnection,
      entityModel: OmniDocumentEntity,
      providerClass: OmniDocumentService,
    },
    dataloader: { databaseKey: 'guid' },
  });
