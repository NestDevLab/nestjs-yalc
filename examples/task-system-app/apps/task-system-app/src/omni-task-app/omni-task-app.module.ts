import { Global, Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventEmitter } from 'node:events';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventModule } from '@nestjs-yalc/event-manager';
import {
  OmniCollectionEntity,
  OmniExternalRefEntity,
  OmniRecordEntity,
  OmniRelationEntity,
} from '@nestjs-yalc/omnikernel-module';
import { TaskAppOmniEventService } from './task-app-omni-event.service';
import { TaskAppOmniExternalRefService } from './task-app-omni-external-ref.service';
import { TaskAppOmniMapper } from './task-app-omni.mapper';
import { TaskAppOmniProjectService } from './task-app-omni-project.service';
import { TaskAppOmniSyncStateService } from './task-app-omni-sync-state.service';
import { TaskAppOmniTaskService } from './task-app-omni-task.service';

@Global()
@Module({
  imports: [
    EventModule.forRootAsync({
      eventEmitter: {
        provide: EventEmitter2,
        useValue: new EventEmitter2(),
      },
    }),
    TypeOrmModule.forFeature(
      [
        OmniRecordEntity,
        OmniCollectionEntity,
        OmniRelationEntity,
        OmniExternalRefEntity,
      ],
      'default',
    ),
  ],
  providers: [
    {
      provide: EventEmitter,
      useValue: new EventEmitter(),
    },
    TaskAppOmniMapper,
    TaskAppOmniProjectService,
    TaskAppOmniTaskService,
    TaskAppOmniEventService,
    TaskAppOmniExternalRefService,
    TaskAppOmniSyncStateService,
  ],
  exports: [
    TaskAppOmniMapper,
    TaskAppOmniProjectService,
    TaskAppOmniTaskService,
    TaskAppOmniEventService,
    TaskAppOmniExternalRefService,
    TaskAppOmniSyncStateService,
  ],
})
export class OmniTaskAppModule {}
