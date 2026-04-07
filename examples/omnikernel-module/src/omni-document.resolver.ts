import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import {
  OmniDocumentCondition,
  OmniDocumentCreateInput,
  OmniDocumentType,
  OmniDocumentUpdateInput,
} from './omni-document.dto.js';
import { OmniDocumentEntity } from './omni-document.entity.js';

export const omniDocumentProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<OmniDocumentEntity>({
    entityModel: OmniDocumentEntity,
    resolver: {
      dto: OmniDocumentType,
      input: {
        create: OmniDocumentCreateInput,
        update: OmniDocumentUpdateInput,
        conditions: OmniDocumentCondition,
      },
      prefix: 'OmniKernel_',
    },
    service: {
      dbConnection,
      entityModel: OmniDocumentEntity,
    },
    dataloader: { databaseKey: 'guid' },
  });
