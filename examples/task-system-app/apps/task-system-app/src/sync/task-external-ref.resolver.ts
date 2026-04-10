import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import {
  GQLDataLoader,
  getDataloaderToken,
  getFn,
} from '@nestjs-yalc/data-loader';
import { getServiceToken } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import { TaskExternalRef } from '@nestjs-yalc/task-system-module/src/task-external-ref.entity';
import { TaskAppOmniExternalRefService } from '../omni-task-app/task-app-omni-external-ref.service';
import {
  TaskExternalRefCondition,
  TaskExternalRefCreateInput,
  TaskExternalRefType,
  TaskExternalRefUpdateInput,
} from './task-external-ref.dto';

export const taskExternalRefProviders =
  CrudGenDependencyFactory<TaskExternalRef>({
    entityModel: TaskExternalRef,
    resolver: {
      dto: TaskExternalRefType,
      input: {
        create: TaskExternalRefCreateInput,
        update: TaskExternalRefUpdateInput,
        conditions: TaskExternalRefCondition,
      },
      prefix: 'TaskSystem_',
    },
    service: {
      provider: {
        provide: getServiceToken(TaskExternalRef),
        useExisting: TaskAppOmniExternalRefService,
      },
    },
    dataloader: {
      provider: {
        provide: getDataloaderToken(TaskExternalRef),
        useFactory: (service: TaskAppOmniExternalRefService) =>
          new GQLDataLoader(getFn(service as any), 'guid'),
        inject: [getServiceToken(TaskExternalRef)],
      },
    },
  });
