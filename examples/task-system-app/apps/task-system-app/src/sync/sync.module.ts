import { Module } from '@nestjs/common';
import { TaskAppEventModule } from '../task-app-event.module';
import { ExternalRefsController } from './external-refs.rest.controller';
import { SyncStatesController } from './sync-states.rest.controller';
import {
  taskExternalRefDataloaderEventEmitterToken,
  taskExternalRefProviders,
} from './task-external-ref.resolver';

@Module({
  imports: [TaskAppEventModule],
  controllers: [ExternalRefsController, SyncStatesController],
  providers: [
    ...(taskExternalRefDataloaderEventEmitterToken
      ? [
          {
            provide: taskExternalRefDataloaderEventEmitterToken,
            useValue: new (taskExternalRefDataloaderEventEmitterToken as new () => unknown)(),
          },
        ]
      : []),
    ...taskExternalRefProviders,
  ],
})
export class SyncModule {}
