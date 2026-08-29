import {
  createProjectionDialect,
  createProjectionGraphqlTypes,
  CrudGenResourceFactory,
} from '@nestjs-yalc/crud-gen';
import { getServiceToken } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import {
  GQLDataLoader,
  getDataloaderToken,
  getFn,
} from '@nestjs-yalc/data-loader';
import { bindGeneratedDataloaderEventEmitter } from '../crudgen-provider-compat.js';
import {
  TASK_SYNC_STATE_PROJECTION_DIALECT,
  TASK_SYNC_STATE_PROJECTION_SCOPE,
  TaskSyncStateProjectionIndexesBootstrap,
  TaskSyncStateProjectionService,
} from './task-sync-state-projection.service';
import {
  taskSyncStateProjectionDefinition,
  taskSyncStateProjectionScope,
  TaskSyncStateProjectionApi,
} from './task-sync-state.projection';

const taskSyncStateGraphqlTypes = createProjectionGraphqlTypes(
  taskSyncStateProjectionDefinition,
  {
    object: 'TaskSyncStateType',
    create: 'TaskSyncStateCreateInput',
    patch: 'TaskSyncStateUpdateInput',
    conditions: 'TaskSyncStateCondition',
  },
);

export const taskSyncStateResource =
  CrudGenResourceFactory<TaskSyncStateProjectionApi>({
    entityModel: TaskSyncStateProjectionApi,
    backend: false,
    graphql: {
      resolver: {
        dto: taskSyncStateGraphqlTypes.object,
        input: {
          create: taskSyncStateGraphqlTypes.create,
          update: taskSyncStateGraphqlTypes.patch,
          conditions: taskSyncStateGraphqlTypes.conditions,
        },
        prefix: 'TaskSystem_',
        queries: {
          getResource: {
            idName: 'guid',
            queryParams: { name: 'TaskSystem_getTaskSyncState' },
          },
          getResourceGrid: {
            queryParams: { name: 'TaskSystem_getTaskSyncStateGrid' },
          },
        },
        mutations: {
          createResource: {
            queryParams: { name: 'TaskSystem_createTaskSyncState' },
          },
          updateResource: {
            queryParams: { name: 'TaskSystem_updateTaskSyncState' },
          },
          deleteResource: {
            queryParams: { name: 'TaskSystem_deleteTaskSyncState' },
          },
        },
      },
      serviceToken: getServiceToken(TaskSyncStateProjectionApi),
      dataLoaderToken: getDataloaderToken(TaskSyncStateProjectionApi),
    },
    rest: {
      dto: taskSyncStateGraphqlTypes.object,
      path: 'sync-states',
      idField: 'guid',
      serviceToken: getServiceToken(TaskSyncStateProjectionApi),
    },
  });

export const SyncStatesController = taskSyncStateResource.controllers[0];
export const taskSyncStateProviders = bindGeneratedDataloaderEventEmitter([
  {
    provide: TASK_SYNC_STATE_PROJECTION_SCOPE,
    useValue: taskSyncStateProjectionScope,
  },
  {
    provide: TASK_SYNC_STATE_PROJECTION_DIALECT,
    useValue: createProjectionDialect('sqlite'),
  },
  TaskSyncStateProjectionIndexesBootstrap,
  TaskSyncStateProjectionService,
  {
    provide: getServiceToken(TaskSyncStateProjectionApi),
    useExisting: TaskSyncStateProjectionService,
  },
  {
    provide: getDataloaderToken(TaskSyncStateProjectionApi),
    useFactory: (service: TaskSyncStateProjectionService) =>
      new GQLDataLoader(getFn(service as any), 'guid', undefined, {
        cacheKeyFn: (key) => taskSyncStateProjectionScope.cacheKey(key),
      }),
    inject: [getServiceToken(TaskSyncStateProjectionApi)],
  },
  ...taskSyncStateResource.providers,
]);
