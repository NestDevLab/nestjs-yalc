import { Global, Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventModule } from '@nestjs-yalc/event-manager';
import {
  OmniCollectionEntity,
  OmniExternalRefEntity,
  OmniKernelModule,
  OmniRecordEntity,
  OmniRelationEntity,
} from '@nestjs-yalc/omnikernel-module';
import {
  TaskExternalRef,
  TaskItem,
  TaskProject,
} from '@nestjs-yalc/task-system-module';
import { TaskAppOmniExternalRefService } from './task-app-omni-external-ref.service';
import { TaskAppOmniMapper } from './task-app-omni.mapper';
import { TaskAppOmniProjectService } from './task-app-omni-project.service';
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
    OmniKernelModule.register('default'),
    TypeOrmModule.forFeature(
      [
        OmniRecordEntity,
        OmniCollectionEntity,
        OmniRelationEntity,
        OmniExternalRefEntity,
        TaskProject,
        TaskItem,
        TaskExternalRef,
      ],
      'default',
    ),
  ],
  providers: [
    TaskAppOmniMapper,
    TaskAppOmniProjectService,
    TaskAppOmniTaskService,
    TaskAppOmniExternalRefService,
  ],
  exports: [
    TaskAppOmniMapper,
    TaskAppOmniProjectService,
    TaskAppOmniTaskService,
    TaskAppOmniExternalRefService,
  ],
})
export class OmniTaskAppModule {}
