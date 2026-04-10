import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import {
  GQLDataLoader,
  getDataloaderToken,
  getFn,
} from '@nestjs-yalc/data-loader';
import { getServiceToken } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import { TaskSyncState } from '@nestjs-yalc/task-system-module/src/task-sync-state.entity';
import { TaskAppOmniSyncStateService } from '../omni-task-app/task-app-omni-sync-state.service';
import {
  TaskSyncStateCondition,
  TaskSyncStateCreateInput,
  TaskSyncStateType,
  TaskSyncStateUpdateInput,
} from './task-sync-state.dto';

export const taskSyncStateProviders = CrudGenDependencyFactory<TaskSyncState>({
  entityModel: TaskSyncState,
  resolver: {
    dto: TaskSyncStateType,
    input: {
      create: TaskSyncStateCreateInput,
      update: TaskSyncStateUpdateInput,
      conditions: TaskSyncStateCondition,
    },
    prefix: 'TaskSystem_',
  },
  service: {
    provider: {
      provide: getServiceToken(TaskSyncState),
      useExisting: TaskAppOmniSyncStateService,
    },
  },
  dataloader: {
    provider: {
      provide: getDataloaderToken(TaskSyncState),
      useFactory: (service: TaskAppOmniSyncStateService) =>
        new GQLDataLoader(getFn(service as any), 'guid'),
      inject: [getServiceToken(TaskSyncState)],
    },
  },
});
