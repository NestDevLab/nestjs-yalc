import { Module } from '@nestjs/common';
import { SkeletonCronController } from './skeleton-cron.controller';
import { SkeletonCronService } from './skeleton-cron.service';

@Module({
  imports: [],
  controllers: [SkeletonCronController],
  providers: [SkeletonCronService],
})
export class SkeletonCronModule {}
