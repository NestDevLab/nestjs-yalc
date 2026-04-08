import { crudRestControllerFactory } from '@nestjs-yalc/crud-gen/api-rest/crud-gen-rest.controller.factory';
import { TaskProject, TaskProjectType } from '@nestjs-yalc/task-system-module';

export const ProjectsController = crudRestControllerFactory<TaskProject>({
  entityModel: TaskProject,
  dto: TaskProjectType,
  path: 'projects',
  idField: 'guid',
  mutations: {
    create: { decorators: [] },
    update: { decorators: [] },
  },
});
