import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventEmitter } from 'node:events';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventModule } from '@nestjs-yalc/event-manager';
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
  TaskSystemGraphqlResolver,
} from './graphql-relations.resolver';
import { OmniTaskAppModule } from './omni-task-app/omni-task-app.module';
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
    EventModule.forRootAsync({
      eventEmitter: {
        provide: EventEmitter2,
        useValue: new EventEmitter2(),
      },
    }),
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
    {
      provide: EventEmitter,
      useValue: new EventEmitter(),
    },
    TaskSystemGraphqlResolver,
    TaskItemRelationsResolver,
    TaskEventRelationsResolver,
    TaskProjectRelationsResolver,
  ],
})
export class AppModule {}
