import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import { TaskExternalRef } from './task-external-ref.entity.js';

export const taskExternalRefProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<TaskExternalRef>({
    entityModel: TaskExternalRef,
    resolver: false,
    service: {
      dbConnection,
      entityModel: TaskExternalRef,
    },
  });
