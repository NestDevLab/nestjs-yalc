import { Module } from '@nestjs/common';
import { SkeletonModule } from '@nestjs-yalc/skeleton-module';
import {
  UsersWriteController,
  UsersReadonlyController,
} from './users.rest.controller';

const skeletonModule = SkeletonModule.register('default');

@Module({
  imports: [skeletonModule],
  controllers: [UsersReadonlyController, UsersWriteController],
  exports: [skeletonModule],
})
export class UsersModule {}
