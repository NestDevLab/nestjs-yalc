import { crudRestControllerFactory } from '@nestjs-yalc/crud-gen/api-rest/crud-gen-rest.controller.factory';
import { OmniExternalRefEntity } from '@nestjs-yalc/omnikernel-module';
import { TaskExternalRefType } from './task-external-ref.dto';

export const ExternalRefsController = crudRestControllerFactory<OmniExternalRefEntity>(
  {
    entityModel: OmniExternalRefEntity,
    dto: TaskExternalRefType,
    path: 'external-refs',
    idField: 'guid',
    serviceToken: 'TaskExternalRefGenericService',
  },
);
