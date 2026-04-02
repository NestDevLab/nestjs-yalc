import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import { TaskProject } from './task-project.entity.js';

export const taskProjectProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<TaskProject>({
    entityModel: TaskProject,
    resolver: false,
    service: {
      dbConnection,
      entityModel: TaskProject,
    },
  });
