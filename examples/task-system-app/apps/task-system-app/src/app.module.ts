import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  TaskSystemModule,
  TaskEvent,
  TaskItem,
  TaskProject,
  TaskSyncRef,
} from '@nestjs-yalc/task-system-module';
import { EventsModule } from './events/events.module';
import { ProjectsModule } from './projects/projects.module';
import { SyncModule } from './sync/sync.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      entities: [TaskItem, TaskProject, TaskEvent, TaskSyncRef],
      synchronize: true,
    }),
    TaskSystemModule.register('default'),
    TasksModule,
    ProjectsModule,
    EventsModule,
    SyncModule,
  ],
})
export class AppModule {}
