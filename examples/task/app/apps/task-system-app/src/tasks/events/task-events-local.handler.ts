import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import {
  TASK_CREATED_EVENT,
  TASK_STATUS_CHANGED_EVENT,
  type TaskDomainEventPayload,
} from '@nestjs-yalc/task-system-module/src/events/tasks-events.client';
import { TaskEventsAuditStore } from './task-events-audit.store';

@Injectable()
export class TaskEventsLocalHandler implements OnModuleInit, OnModuleDestroy {
  private readonly onTaskCreated = (payload: TaskDomainEventPayload) => {
    this.audit.record({
      eventName: TASK_CREATED_EVENT,
      source: 'local',
      payload,
    });
  };

  private readonly onTaskStatusChanged = (payload: TaskDomainEventPayload) => {
    this.audit.record({
      eventName: TASK_STATUS_CHANGED_EVENT,
      source: 'local',
      payload,
    });
  };

  constructor(
    private readonly events: YalcEventService,
    private readonly audit: TaskEventsAuditStore,
  ) {}

  onModuleInit() {
    this.events.emitter.on(TASK_CREATED_EVENT, this.onTaskCreated);
    this.events.emitter.on(TASK_STATUS_CHANGED_EVENT, this.onTaskStatusChanged);
  }

  onModuleDestroy() {
    this.events.emitter.off(TASK_CREATED_EVENT, this.onTaskCreated);
    this.events.emitter.off(
      TASK_STATUS_CHANGED_EVENT,
      this.onTaskStatusChanged,
    );
  }
}
