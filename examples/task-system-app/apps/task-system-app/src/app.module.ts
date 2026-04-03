import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar';
import {
  TaskSystemModule,
  TaskEvent,
  TaskExternalRef,
  TaskItem,
  TaskProject,
  TaskSyncState,
} from '@nestjs-yalc/task-system-module';
import { EventsModule } from './events/events.module';
import { ProjectsModule } from './projects/projects.module';
import { SyncModule } from './sync/sync.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      path: '/graphql',
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      entities: [
        TaskItem,
        TaskProject,
        TaskEvent,
        TaskExternalRef,
        TaskSyncState,
      ],
      synchronize: true,
    }),
    TaskSystemModule.register('default'),
    TasksModule,
    ProjectsModule,
    EventsModule,
    SyncModule,
  ],
  providers: [UUIDScalar],
})
export class AppModule {}
