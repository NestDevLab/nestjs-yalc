import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkeletonModule } from '@nestjs-yalc/skeleton-module';
import { SkeletonPhone } from '@nestjs-yalc/skeleton-module/src/skeleton-phone.entity';
import { SkeletonUser } from '@nestjs-yalc/skeleton-module/src/skeleton-user.entity';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar';
import { PhonesModule } from './phones/phones.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      path: '/graphql',
    }),
    TypeOrmModule.forRoot({
      type: 'sqljs',
      autoSave: false,
      dropSchema: true,
      entities: [SkeletonUser, SkeletonPhone],
      synchronize: true,
    }),
    SkeletonModule.register('default'),
    UsersModule,
    PhonesModule,
  ],
  providers: [UUIDScalar],
})
export class AppModule {}
