import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import {
  TaskEventCondition,
  TaskEventCreateInput,
  TaskEventType,
  TaskEventUpdateInput,
} from './task-event.dto.js';
import { TaskEvent } from './task-event.entity.js';

export const taskEventProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<TaskEvent>({
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
      dbConnection,
      entityModel: TaskEvent,
    },
    dataloader: { databaseKey: 'guid' },
  });
