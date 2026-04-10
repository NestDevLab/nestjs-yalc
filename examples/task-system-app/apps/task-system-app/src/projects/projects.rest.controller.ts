import { crudRestControllerFactory } from '@nestjs-yalc/crud-gen/api-rest/crud-gen-rest.controller.factory';
import { getServiceToken } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import { TaskProject } from '@nestjs-yalc/task-system-module/src/task-project.entity';
import { TaskProjectType } from './task-project.dto';

export const ProjectsController = crudRestControllerFactory<TaskProject>({
  entityModel: TaskProject,
  dto: TaskProjectType,
  path: 'projects',
  idField: 'guid',
  serviceToken: getServiceToken(TaskProject),
});
