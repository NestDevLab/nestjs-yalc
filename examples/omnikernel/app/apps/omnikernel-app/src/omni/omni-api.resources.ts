import { CrudGenResourceFactory } from '@nestjs-yalc/crud-gen';
import {
  OmniCollectionCondition,
  OmniCollectionCreateInput,
  OmniCollectionEntity,
  OmniCollectionService,
  OmniCollectionType,
  OmniCollectionUpdateInput,
  OmniDocumentCondition,
  OmniDocumentCreateInput,
  OmniDocumentEntity,
  OmniDocumentService,
  OmniDocumentType,
  OmniDocumentUpdateInput,
  OmniExternalRefCondition,
  OmniExternalRefCreateInput,
  OmniExternalRefEntity,
  OmniExternalRefService,
  OmniExternalRefType,
  OmniExternalRefUpdateInput,
  OmniNamedCondition,
  OmniNamedCreateInput,
  OmniNamedEntity,
  OmniNamedType,
  OmniNamedUpdateInput,
  OmniRecordCondition,
  OmniRecordCreateInput,
  OmniRecordEntity,
  OmniRecordType,
  OmniRecordUpdateInput,
  OmniRelationCondition,
  OmniRelationCreateInput,
  OmniRelationEntity,
  OmniRelationType,
  OmniRelationUpdateInput,
} from '@nestjs-yalc/omnikernel-module';

export const omniNamedResource = CrudGenResourceFactory<OmniNamedEntity>({
  entityModel: OmniNamedEntity,
  backend: false,
  graphql: {
    resolver: {
      dto: OmniNamedType,
      input: {
        create: OmniNamedCreateInput,
        update: OmniNamedUpdateInput,
        conditions: OmniNamedCondition,
      },
      prefix: 'OmniKernel_',
    },
  },
  rest: {
    dto: OmniNamedType,
    path: 'omni/named',
    idField: 'guid',
  },
});

export const omniRecordResource = CrudGenResourceFactory<OmniRecordEntity>({
  entityModel: OmniRecordEntity,
  backend: false,
  graphql: {
    resolver: {
      dto: OmniRecordType,
      input: {
        create: OmniRecordCreateInput,
        update: OmniRecordUpdateInput,
        conditions: OmniRecordCondition,
      },
      prefix: 'OmniKernel_',
    },
  },
  rest: {
    dto: OmniRecordType,
    path: 'omni/records',
    idField: 'guid',
  },
});

export const omniDocumentResource = CrudGenResourceFactory<OmniDocumentEntity>({
  entityModel: OmniDocumentEntity,
  backend: false,
  graphql: {
    resolver: {
      dto: OmniDocumentType,
      input: {
        create: OmniDocumentCreateInput,
        update: OmniDocumentUpdateInput,
        conditions: OmniDocumentCondition,
      },
      prefix: 'OmniKernel_',
    },
    serviceToken: OmniDocumentService.name,
  },
  rest: {
    dto: OmniDocumentType,
    path: 'omni/documents',
    idField: 'guid',
    serviceToken: OmniDocumentService.name,
  },
});

export const omniCollectionResource =
  CrudGenResourceFactory<OmniCollectionEntity>({
    entityModel: OmniCollectionEntity,
    backend: false,
    graphql: {
      resolver: {
        dto: OmniCollectionType,
        input: {
          create: OmniCollectionCreateInput,
          update: OmniCollectionUpdateInput,
          conditions: OmniCollectionCondition,
        },
        prefix: 'OmniKernel_',
      },
      serviceToken: OmniCollectionService.name,
    },
    rest: {
      dto: OmniCollectionType,
      path: 'omni/collections',
      idField: 'guid',
      serviceToken: OmniCollectionService.name,
    },
  });

export const omniRelationResource = CrudGenResourceFactory<OmniRelationEntity>({
  entityModel: OmniRelationEntity,
  backend: false,
  graphql: {
    resolver: {
      dto: OmniRelationType,
      input: {
        create: OmniRelationCreateInput,
        update: OmniRelationUpdateInput,
        conditions: OmniRelationCondition,
      },
      prefix: 'OmniKernel_',
    },
  },
  rest: {
    dto: OmniRelationType,
    path: 'omni/relations',
    idField: 'guid',
  },
});

export const omniExternalRefResource =
  CrudGenResourceFactory<OmniExternalRefEntity>({
    entityModel: OmniExternalRefEntity,
    backend: false,
    graphql: {
      resolver: {
        dto: OmniExternalRefType,
        input: {
          create: OmniExternalRefCreateInput,
          update: OmniExternalRefUpdateInput,
          conditions: OmniExternalRefCondition,
        },
        prefix: 'OmniKernel_',
      },
      serviceToken: OmniExternalRefService.name,
    },
    rest: {
      dto: OmniExternalRefType,
      path: 'omni/external-refs',
      idField: 'guid',
      serviceToken: OmniExternalRefService.name,
    },
  });

const omniResources = [
  omniNamedResource,
  omniRecordResource,
  omniDocumentResource,
  omniCollectionResource,
  omniRelationResource,
  omniExternalRefResource,
];

export const omniApiProviders = omniResources.flatMap(
  (resource) => resource.providers,
);
export const omniApiControllers = omniResources.flatMap(
  (resource) => resource.controllers,
);
