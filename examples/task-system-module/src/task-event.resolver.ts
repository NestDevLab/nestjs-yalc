import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import { TaskEvent } from './task-event.entity.js';

export const taskEventProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<TaskEvent>({
    entityModel: TaskEvent,
    resolver: false,
    service: {
      dbConnection,
      entityModel: TaskEvent,
    },
  });
