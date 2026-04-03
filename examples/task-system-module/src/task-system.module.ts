import { DynamicModule, Global, Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEvent } from './task-event.entity.js';
import { taskEventProvidersFactory } from './task-event.resolver.js';
import { TaskItem } from './task-item.entity.js';
import { taskItemProvidersFactory } from './task-item.resolver.js';
import { TaskProject } from './task-project.entity.js';
import { taskProjectProvidersFactory } from './task-project.resolver.js';
import { TaskSyncRef } from './task-sync-ref.entity.js';
import { taskSyncRefProvidersFactory } from './task-sync-ref.resolver.js';

@Global()
@Module({})
export class TaskSystemModule {
  static register(dbConnection: string): DynamicModule {
    const taskProjectProviders = taskProjectProvidersFactory(dbConnection);
    const taskItemProviders = taskItemProvidersFactory(dbConnection);
    const taskEventProviders = taskEventProvidersFactory(dbConnection);
    const taskSyncRefProviders = taskSyncRefProvidersFactory(dbConnection);

    return {
      module: TaskSystemModule,
      imports: [
        TypeOrmModule.forFeature(
          [TaskProject, TaskItem, TaskEvent, TaskSyncRef],
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
        ...taskSyncRefProviders.providers,
      ],
      exports: [
        ...taskProjectProviders.providers,
        ...taskItemProviders.providers,
        ...taskEventProviders.providers,
        ...taskSyncRefProviders.providers,
      ],
    };
  }
}
