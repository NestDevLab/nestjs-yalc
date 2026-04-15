import { CrudGenResourceFactory } from '@nestjs-yalc/crud-gen';
import { getServiceToken } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import {
  GQLDataLoader,
  getDataloaderToken,
  getFn,
} from '@nestjs-yalc/data-loader';
import { TaskSyncState } from '@nestjs-yalc/task-system-module/src/task-sync-state.entity';
import { bindGeneratedDataloaderEventEmitter } from '../crudgen-provider-compat.js';
import { TaskAppOmniSyncStateService } from '../omni-task-app/task-app-omni-sync-state.service';
import {
  TaskSyncStateCondition,
  TaskSyncStateCreateInput,
  TaskSyncStateType,
  TaskSyncStateUpdateInput,
} from './task-sync-state.dto';

export const taskSyncStateResource = CrudGenResourceFactory<TaskSyncState>({
  entityModel: TaskSyncState,
  backend: {
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
  },
  graphql: {
    resolver: {
      dto: TaskSyncStateType,
      input: {
        create: TaskSyncStateCreateInput,
        update: TaskSyncStateUpdateInput,
        conditions: TaskSyncStateCondition,
      },
      prefix: 'TaskSystem_',
    },
  },
  rest: {
    dto: TaskSyncStateType,
    path: 'sync-states',
    idField: 'guid',
  },
});

export const SyncStatesController = taskSyncStateResource.controllers[0];
export const taskSyncStateProviders = bindGeneratedDataloaderEventEmitter(
  taskSyncStateResource.providers,
);
