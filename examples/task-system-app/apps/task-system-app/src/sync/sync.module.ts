import { Module } from '@nestjs/common';
import { ExternalRefsController } from './external-refs.rest.controller';
import { SyncStatesController } from './sync-states.rest.controller';

@Module({
  controllers: [ExternalRefsController, SyncStatesController],
})
export class SyncModule {}
