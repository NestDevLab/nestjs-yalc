import { crudRestControllerFactory } from '@nestjs-yalc/crud-gen/api-rest/crud-gen-rest.controller.factory';
import { getServiceToken } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import { TaskEvent } from '@nestjs-yalc/task-system-module/src/task-event.entity';
import { TaskEventType } from './task-event.dto';

export const EventsController = crudRestControllerFactory<TaskEvent>({
  entityModel: TaskEvent,
  dto: TaskEventType,
  path: 'events',
  idField: 'guid',
  serviceToken: getServiceToken(TaskEvent),
});
