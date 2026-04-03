import { crudRestControllerFactory } from '@nestjs-yalc/crud-gen/api-rest/crud-gen-rest.controller.factory';
import {
  TaskExternalRef,
  TaskExternalRefType,
} from '@nestjs-yalc/task-system-module';

export const ExternalRefsController =
  crudRestControllerFactory<TaskExternalRef>({
    entityModel: TaskExternalRef,
    dto: TaskExternalRefType,
    path: 'external-refs',
    idField: 'guid',
    mutations: {
      create: { decorators: [] },
      update: { decorators: [] },
    },
  });
