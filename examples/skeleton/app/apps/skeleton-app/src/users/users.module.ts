import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkeletonUser } from '@nestjs-yalc/skeleton-module';
import { UsersController, usersResourceProviders } from './users.resource';
import { UsersErrorsController } from './users.errors.controller';
import { UsersProxyController } from './users.proxy.controller';
import { UsersLoggingController } from './users.logging.controller';
import { UsersValidationController } from './users.validation.controller';
import { HttpModule } from '@nestjs/axios';
import { YalcClsModule } from '@nestjs-yalc/app/cls.module.js';
import { NestHttpCallStrategyProvider } from '@nestjs-yalc/api-strategy';
import { UsersProxyService } from './users.proxy.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventModule } from '@nestjs-yalc/event-manager';

@Module({
  imports: [
    TypeOrmModule.forFeature([SkeletonUser], 'default'),
    HttpModule,
    YalcClsModule,
    EventEmitterModule.forRoot(),
    EventModule.forRootAsync(),
  ],
  controllers: [
    UsersController,
    UsersErrorsController,
    UsersProxyController,
    UsersLoggingController,
    UsersValidationController,
  ],
  providers: [
    ...usersResourceProviders,
    UsersProxyService,
    NestHttpCallStrategyProvider('USERS_HTTP_STRATEGY', {
      baseUrl: '',
    }),
  ],
  exports: [TypeOrmModule],
})
export class UsersModule {}
