import { Module } from '@nestjs/common';
import {
  ExternalRefsController,
  taskExternalRefProviders,
} from './task-external-ref.resource';
import {
  SyncStatesController,
  taskSyncStateProviders,
} from './task-sync-state.resource';

@Module({
  controllers: [ExternalRefsController, SyncStatesController],
  providers: [...taskExternalRefProviders, ...taskSyncStateProviders],
})
export class SyncModule {}
