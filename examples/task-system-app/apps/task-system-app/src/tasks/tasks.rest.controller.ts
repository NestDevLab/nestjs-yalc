import { crudRestControllerFactory } from '@nestjs-yalc/crud-gen/api-rest/crud-gen-rest.controller.factory';
import { TaskItem, TaskItemType } from '@nestjs-yalc/task-system-module';

export const TasksController = crudRestControllerFactory<TaskItem>({
  entityModel: TaskItem,
  dto: TaskItemType,
  path: 'tasks',
  idField: 'guid',
  mutations: {
    create: { decorators: [] },
    update: { decorators: [] },
  },
});
