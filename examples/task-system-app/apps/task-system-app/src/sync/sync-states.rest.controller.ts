import { crudRestControllerFactory } from '@nestjs-yalc/crud-gen/api-rest/crud-gen-rest.controller.factory';
import { getServiceToken } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import { TaskSyncState } from '@nestjs-yalc/task-system-module/src/task-sync-state.entity';
import { TaskSyncStateType } from './task-sync-state.dto';

export const SyncStatesController = crudRestControllerFactory<TaskSyncState>({
  entityModel: TaskSyncState,
  dto: TaskSyncStateType,
  path: 'sync-states',
  idField: 'guid',
  serviceToken: getServiceToken(TaskSyncState),
});
