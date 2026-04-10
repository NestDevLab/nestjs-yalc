import { Module } from '@nestjs/common';
import { ExternalRefsController } from './external-refs.rest.controller';
import { SyncStatesController } from './sync-states.rest.controller';
import { taskExternalRefProviders } from './task-external-ref.resolver';
import { taskSyncStateProviders } from './task-sync-state.resolver';

@Module({
  controllers: [ExternalRefsController, SyncStatesController],
  providers: [
    ...taskExternalRefProviders.providers,
    ...taskSyncStateProviders.providers,
  ],
})
export class SyncModule {}
