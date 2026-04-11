import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { OmniApiModule } from './omni/omni-api.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      path: '/graphql',
    }),
    EventEmitterModule.forRoot(),
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
    OmniApiModule,
  ],
  providers: [UUIDScalar],
})
export class AppModule {}
