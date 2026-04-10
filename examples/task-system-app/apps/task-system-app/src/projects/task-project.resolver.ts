import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import {
  GQLDataLoader,
  getDataloaderToken,
  getFn,
} from '@nestjs-yalc/data-loader';
import { getServiceToken } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import { TaskProject } from '@nestjs-yalc/task-system-module/src/task-project.entity';
import { TaskAppOmniProjectService } from '../omni-task-app/task-app-omni-project.service';
import {
  TaskProjectCondition,
  TaskProjectCreateInput,
  TaskProjectType,
  TaskProjectUpdateInput,
} from './task-project.dto';

export const taskProjectProviders = CrudGenDependencyFactory<TaskProject>({
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
});
