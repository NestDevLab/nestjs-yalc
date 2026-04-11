import { crudRestControllerFactory } from '@nestjs-yalc/crud-gen/api-rest/crud-gen-rest.controller.factory';
import {
  OmniCollectionEntity,
  OmniCollectionService,
  OmniCollectionType,
  OmniDocumentEntity,
  OmniDocumentService,
  OmniDocumentType,
  OmniExternalRefEntity,
  OmniExternalRefService,
  OmniExternalRefType,
  OmniNamedEntity,
  OmniNamedType,
  OmniRecordEntity,
  OmniRecordType,
  OmniRelationEntity,
  OmniRelationType,
} from '@nestjs-yalc/omnikernel-module';

export const OmniNamedController = crudRestControllerFactory<OmniNamedEntity>({
  entityModel: OmniNamedEntity,
  dto: OmniNamedType,
  path: 'omni/named',
  idField: 'guid',
});

export const OmniRecordController = crudRestControllerFactory<OmniRecordEntity>(
  {
    entityModel: OmniRecordEntity,
    dto: OmniRecordType,
    path: 'omni/records',
    idField: 'guid',
  },
);

export const OmniDocumentController =
  crudRestControllerFactory<OmniDocumentEntity>({
    entityModel: OmniDocumentEntity,
    dto: OmniDocumentType,
    path: 'omni/documents',
    idField: 'guid',
    serviceToken: OmniDocumentService,
  });

export const OmniCollectionController =
  crudRestControllerFactory<OmniCollectionEntity>({
    entityModel: OmniCollectionEntity,
    dto: OmniCollectionType,
    path: 'omni/collections',
    idField: 'guid',
    serviceToken: OmniCollectionService,
  });

export const OmniRelationController =
  crudRestControllerFactory<OmniRelationEntity>({
    entityModel: OmniRelationEntity,
    dto: OmniRelationType,
    path: 'omni/relations',
    idField: 'guid',
  });

export const OmniExternalRefController =
  crudRestControllerFactory<OmniExternalRefEntity>({
    entityModel: OmniExternalRefEntity,
    dto: OmniExternalRefType,
    path: 'omni/external-refs',
    idField: 'guid',
    serviceToken: OmniExternalRefService,
  });
