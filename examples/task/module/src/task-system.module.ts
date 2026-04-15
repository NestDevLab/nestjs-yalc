import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
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

type ProviderWithInject = Provider & { inject?: unknown[] };

const bindGeneratedDataloaderEventEmitter = (
  providers: Provider[],
): Provider[] =>
  providers.map((provider) => {
    if (typeof provider !== 'object' || provider === null) return provider;

    const providerWithInject = provider as ProviderWithInject;
    if (!Array.isArray(providerWithInject.inject)) return provider;

    return {
      ...providerWithInject,
      inject: providerWithInject.inject.map((token) => token ?? EventEmitter2),
    } as Provider;
  });

@Global()
@Module({})
export class TaskSystemModule {
  static register(dbConnection: string): DynamicModule {
    const taskProjectProviders = bindGeneratedDataloaderEventEmitter(
      taskProjectProvidersFactory(dbConnection).providers,
    );
    const taskItemProviders = bindGeneratedDataloaderEventEmitter(
      taskItemProvidersFactory(dbConnection).providers,
    );
    const taskEventProviders = bindGeneratedDataloaderEventEmitter(
      taskEventProvidersFactory(dbConnection).providers,
    );
    const taskExternalRefProviders = bindGeneratedDataloaderEventEmitter(
      taskExternalRefProvidersFactory(dbConnection).providers,
    );
    const taskSyncStateProviders = bindGeneratedDataloaderEventEmitter(
      taskSyncStateProvidersFactory(dbConnection).providers,
    );
    const eventEmitter = new EventEmitter2();

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
          useValue: eventEmitter,
        },
        ...taskProjectProviders,
        ...taskItemProviders,
        ...taskEventProviders,
        ...taskExternalRefProviders,
        ...taskSyncStateProviders,
      ],
      exports: [
        EventEmitter2,
        ...taskProjectProviders,
        ...taskItemProviders,
        ...taskEventProviders,
        ...taskExternalRefProviders,
        ...taskSyncStateProviders,
      ],
    };
  }
}
