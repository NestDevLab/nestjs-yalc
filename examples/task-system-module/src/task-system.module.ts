import { DynamicModule, Global, Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEvent } from './task-event.entity.js';
import { taskEventProvidersFactory } from './task-event.resolver.js';
import { TaskExternalRef } from './task-external-ref.entity.js';
import { taskExternalRefProvidersFactory } from './task-external-ref.resolver.js';
import { TaskItem } from './task-item.entity.js';
import { taskItemProvidersFactory } from './task-item.resolver.js';
import { TaskProject } from './task-project.entity.js';
import { taskProjectProvidersFactory } from './task-project.resolver.js';
import { TaskSyncState } from './task-sync-state.entity.js';
import { taskSyncStateProvidersFactory } from './task-sync-state.resolver.js';

@Global()
@Module({})
export class TaskSystemModule {
  static register(dbConnection: string): DynamicModule {
    const taskProjectProviders = taskProjectProvidersFactory(dbConnection);
    const taskItemProviders = taskItemProvidersFactory(dbConnection);
    const taskEventProviders = taskEventProvidersFactory(dbConnection);
    const taskExternalRefProviders =
      taskExternalRefProvidersFactory(dbConnection);
    const taskSyncStateProviders = taskSyncStateProvidersFactory(dbConnection);

    return {
      module: TaskSystemModule,
      imports: [
        TypeOrmModule.forFeature(
          [TaskProject, TaskItem, TaskEvent, TaskExternalRef, TaskSyncState],
          dbConnection,
        ),
      ],
      providers: [
        {
          provide: EventEmitter2,
          useValue: new EventEmitter2(),
        },
        ...taskProjectProviders.providers,
        ...taskItemProviders.providers,
        ...taskEventProviders.providers,
        ...taskExternalRefProviders.providers,
        ...taskSyncStateProviders.providers,
      ],
      exports: [
        EventEmitter2,
        ...taskProjectProviders.providers,
        ...taskItemProviders.providers,
        ...taskEventProviders.providers,
        ...taskExternalRefProviders.providers,
        ...taskSyncStateProviders.providers,
      ],
    };
  }
}
