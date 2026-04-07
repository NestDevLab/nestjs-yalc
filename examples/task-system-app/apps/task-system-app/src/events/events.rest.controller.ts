import { crudRestControllerFactory } from '@nestjs-yalc/crud-gen/api-rest/crud-gen-rest.controller.factory';
import { TaskEvent, TaskEventType } from '@nestjs-yalc/task-system-module';

export const EventsController = crudRestControllerFactory<TaskEvent>({
  entityModel: TaskEvent,
  dto: TaskEventType,
  path: 'events',
  idField: 'guid',
  mutations: {
    create: { decorators: [] },
    update: { decorators: [] },
  },
});
