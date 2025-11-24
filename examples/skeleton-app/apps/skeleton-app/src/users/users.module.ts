import { Module } from '@nestjs/common';
import { SkeletonModule } from '@nestjs-yalc/skeleton-module';
import { UsersController } from './users.rest.controller';
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

const skeletonModule = SkeletonModule.register('default');

@Module({
  imports: [
    skeletonModule,
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
    UsersProxyService,
    NestHttpCallStrategyProvider('USERS_HTTP_STRATEGY', {
      baseUrl: '',
    }),
  ],
  exports: [skeletonModule],
})
export class UsersModule {}
