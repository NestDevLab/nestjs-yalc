import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import {
  TaskProjectCondition,
  TaskProjectCreateInput,
  TaskProjectType,
  TaskProjectUpdateInput,
} from './task-project.dto.js';
import { TaskProject } from './task-project.entity.js';

export const taskProjectProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<TaskProject>({
    entityModel: TaskProject,
    resolver: {
      dto: TaskProjectType,
      input: {
        create: TaskProjectCreateInput,
        update: TaskProjectUpdateInput,
        conditions: TaskProjectCondition,
      },
      prefix: 'TaskSystem_',
    },
    service: {
      dbConnection,
      entityModel: TaskProject,
    },
    dataloader: { databaseKey: 'guid' },
  });
