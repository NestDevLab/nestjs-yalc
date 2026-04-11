import {
  CrudGenBackendFactory,
  CrudGenDependencyFactory,
  CrudGenGraphqlFactory,
} from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import {
  OmniDocumentCondition,
  OmniDocumentCreateInput,
  OmniDocumentType,
  OmniDocumentUpdateInput,
} from './omni-document.dto';
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

export const omniDocumentGraphqlProvidersFactory = (
  tokens: { serviceToken?: string; dataLoaderToken?: string } = {},
) =>
  CrudGenGraphqlFactory<OmniDocumentEntity>({
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
    serviceToken: tokens.serviceToken,
    dataLoaderToken: tokens.dataLoaderToken,
  });

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
      providerClass: OmniDocumentService,
    },
    dataloader: { databaseKey: 'guid' },
  });
