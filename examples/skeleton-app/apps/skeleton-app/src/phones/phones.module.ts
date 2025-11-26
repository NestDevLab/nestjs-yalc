import { Module } from '@nestjs/common';
import { SkeletonModule } from '@nestjs-yalc/skeleton-module';
import { PhonesController } from './phones.controller';

const skeletonModule = SkeletonModule.register('default');

@Module({
  imports: [skeletonModule],
  controllers: [PhonesController],
  exports: [skeletonModule],
})
export class PhonesModule {}
