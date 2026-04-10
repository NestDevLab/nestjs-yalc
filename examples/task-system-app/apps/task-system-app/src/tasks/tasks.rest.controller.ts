import { crudRestControllerFactory } from '@nestjs-yalc/crud-gen/api-rest/crud-gen-rest.controller.factory';
import { getServiceToken } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import { TaskItem } from '@nestjs-yalc/task-system-module/src/task-item.entity';
import { TaskItemType } from './task-item.dto';

export const TasksController = crudRestControllerFactory<TaskItem>({
  entityModel: TaskItem,
  dto: TaskItemType,
  path: 'tasks',
  idField: 'guid',
  serviceToken: getServiceToken(TaskItem),
});
