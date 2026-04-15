import { CrudGenResourceFactory } from '@nestjs-yalc/crud-gen';
import { getServiceToken } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import {
  GQLDataLoader,
  getDataloaderToken,
  getFn,
} from '@nestjs-yalc/data-loader';
import { TaskProject } from '@nestjs-yalc/task-system-module/src/task-project.entity';
import { bindGeneratedDataloaderEventEmitter } from '../crudgen-provider-compat.js';
import { TaskAppOmniProjectService } from '../omni-task-app/task-app-omni-project.service';
import {
  TaskProjectCondition,
  TaskProjectCreateInput,
  TaskProjectType,
  TaskProjectUpdateInput,
} from './task-project.dto';

export const taskProjectResource = CrudGenResourceFactory<TaskProject>({
  entityModel: TaskProject,
  backend: {
    service: {
      provider: {
        provide: getServiceToken(TaskProject),
        useExisting: TaskAppOmniProjectService,
      },
    },
    dataloader: {
      provider: {
        provide: getDataloaderToken(TaskProject),
        useFactory: (service: TaskAppOmniProjectService) =>
          new GQLDataLoader(getFn(service as any), 'guid'),
        inject: [getServiceToken(TaskProject)],
      },
    },
  },
  graphql: {
    resolver: {
      dto: TaskProjectType,
      input: {
        create: TaskProjectCreateInput,
        update: TaskProjectUpdateInput,
        conditions: TaskProjectCondition,
      },
      prefix: 'TaskSystem_',
    },
  },
  rest: {
    dto: TaskProjectType,
    path: 'projects',
    idField: 'guid',
  },
});

export const ProjectsController = taskProjectResource.controllers[0];
export const taskProjectProviders = bindGeneratedDataloaderEventEmitter(
  taskProjectResource.providers,
);
