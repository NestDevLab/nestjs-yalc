import { DynamicModule, Global, Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskProject } from './task-project.entity.js';
import { TaskItem } from './task-item.entity.js';
import { taskProjectProvidersFactory } from './task-project.resolver.js';
import { taskItemProvidersFactory } from './task-item.resolver.js';

@Global()
@Module({})
export class TaskSystemModule {
  static register(dbConnection: string): DynamicModule {
    const taskProjectProviders = taskProjectProvidersFactory(dbConnection);
    const taskItemProviders = taskItemProvidersFactory(dbConnection);

    return {
      module: TaskSystemModule,
      imports: [
        TypeOrmModule.forFeature([TaskProject, TaskItem], dbConnection),
      ],
      providers: [
        {
          provide: EventEmitter2,
          useValue: new EventEmitter2(),
        },
        ...taskProjectProviders.providers,
        ...taskItemProviders.providers,
      ],
      exports: [
        ...taskProjectProviders.providers,
        ...taskItemProviders.providers,
      ],
    };
  }
}
