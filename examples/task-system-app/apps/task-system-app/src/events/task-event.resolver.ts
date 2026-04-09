import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import {
  GQLDataLoader,
  getDataloaderToken,
  getFn,
} from '@nestjs-yalc/data-loader';
import { getServiceToken } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import { TaskEvent } from '@nestjs-yalc/task-system-module/src/task-event.entity';
import { TaskAppOmniEventService } from '../omni-task-app/task-app-omni-event.service';
import {
  TaskEventCondition,
  TaskEventCreateInput,
  TaskEventType,
  TaskEventUpdateInput,
} from './task-event.dto';

export const taskEventProviders = CrudGenDependencyFactory<TaskEvent>({
  entityModel: TaskEvent,
  resolver: {
    dto: TaskEventType,
    input: {
      create: TaskEventCreateInput,
      update: TaskEventUpdateInput,
      conditions: TaskEventCondition,
    },
    prefix: 'TaskSystem_',
  },
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
});
