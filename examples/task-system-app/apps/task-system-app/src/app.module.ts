import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar';
import {
  OmniCollectionEntity,
  OmniDocumentEntity,
  OmniExternalRefEntity,
  OmniNamedEntity,
  OmniRecordEntity,
  OmniRelationEntity,
} from '@nestjs-yalc/omnikernel-module';
import { EventsModule } from './events/events.module';
import {
  TaskEventRelationsResolver,
  TaskItemRelationsResolver,
  TaskProjectRelationsResolver,
} from './graphql-relations.resolver';
import { OmniTaskAppModule } from './omni-task-app/omni-task-app.module';
import { ProjectsModule } from './projects/projects.module';
import { SyncModule } from './sync/sync.module';
import { TasksModule } from './tasks/tasks.module';
import { TaskAppEventModule } from './task-app-event.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      path: '/graphql',
    }),
    TaskAppEventModule,
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      entities: [
        OmniNamedEntity,
        OmniRecordEntity,
        OmniRelationEntity,
        OmniCollectionEntity,
        OmniDocumentEntity,
        OmniExternalRefEntity,
      ],
      synchronize: true,
    }),
    OmniTaskAppModule,
    TasksModule,
    ProjectsModule,
    EventsModule,
    SyncModule,
  ],
  providers: [
    UUIDScalar,
    TaskItemRelationsResolver,
    TaskEventRelationsResolver,
    TaskProjectRelationsResolver,
  ],
})
export class AppModule {}
