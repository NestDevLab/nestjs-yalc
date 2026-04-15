import { CrudGenResourceFactory } from '@nestjs-yalc/crud-gen';
import { getServiceToken } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import {
  GQLDataLoader,
  getDataloaderToken,
  getFn,
} from '@nestjs-yalc/data-loader';
import { TaskEvent } from '@nestjs-yalc/task-system-module/src/task-event.entity';
import { bindGeneratedDataloaderEventEmitter } from '../crudgen-provider-compat.js';
import { TaskAppOmniEventService } from '../omni-task-app/task-app-omni-event.service';
import {
  TaskEventCondition,
  TaskEventCreateInput,
  TaskEventType,
  TaskEventUpdateInput,
} from './task-event.dto';

export const taskEventResource = CrudGenResourceFactory<TaskEvent>({
  entityModel: TaskEvent,
  backend: {
    service: {
      provider: {
        provide: getServiceToken(TaskEvent),
        useExisting: TaskAppOmniEventService,
      },
    },
    dataloader: {
      provider: {
        provide: getDataloaderToken(TaskEvent),
        useFactory: (service: TaskAppOmniEventService) =>
          new GQLDataLoader(getFn(service as any), 'guid'),
        inject: [getServiceToken(TaskEvent)],
      },
    },
  },
  graphql: {
    resolver: {
      dto: TaskEventType,
      input: {
        create: TaskEventCreateInput,
        update: TaskEventUpdateInput,
        conditions: TaskEventCondition,
      },
      prefix: 'TaskSystem_',
    },
  },
  rest: {
    dto: TaskEventType,
    path: 'events',
    idField: 'guid',
  },
});

export const EventsController = taskEventResource.controllers[0];
export const taskEventProviders = bindGeneratedDataloaderEventEmitter(
  taskEventResource.providers,
);
