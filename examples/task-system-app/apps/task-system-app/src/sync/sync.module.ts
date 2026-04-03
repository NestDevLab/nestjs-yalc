import { Module } from '@nestjs/common';
import { SyncController } from './sync.rest.controller';

@Module({
  controllers: [SyncController],
})
export class SyncModule {}
