import { crudRestControllerFactory } from '@nestjs-yalc/crud-gen/api-rest/crud-gen-rest.controller.factory';
import { getServiceToken } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import { TaskExternalRef } from '@nestjs-yalc/task-system-module/src/task-external-ref.entity';
import { TaskExternalRefType } from './task-external-ref.dto';

export const ExternalRefsController =
  crudRestControllerFactory<TaskExternalRef>({
    entityModel: TaskExternalRef,
    dto: TaskExternalRefType,
    path: 'external-refs',
    idField: 'guid',
    serviceToken: getServiceToken(TaskExternalRef),
  });
