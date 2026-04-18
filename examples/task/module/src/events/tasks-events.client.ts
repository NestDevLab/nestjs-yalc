import { Inject, Injectable } from '@nestjs/common';
import type { IEventStrategy } from '@nestjs-yalc/api-strategy';

export const TASK_EVENTS_STRATEGY = 'TASK_EVENTS_STRATEGY';
export const TASK_EVENTS_LOCAL_STRATEGY = 'TASK_EVENTS_LOCAL_STRATEGY';
export const TASK_EVENTS_RABBITMQ_STRATEGY = 'TASK_EVENTS_RABBITMQ_STRATEGY';

export const TASK_CREATED_EVENT = 'task-system.tasks.created';
export const TASK_STATUS_CHANGED_EVENT = 'task-system.tasks.status-changed';

export interface TaskCreatedEventPayload {
  eventName: typeof TASK_CREATED_EVENT;
  taskId: string;
  projectId: string | null;
  occurredAt: string;
}

export interface TaskStatusChangedEventPayload {
  eventName: typeof TASK_STATUS_CHANGED_EVENT;
  taskId: string;
  status: string;
  occurredAt: string;
}

export type TaskDomainEventPayload =
  | TaskCreatedEventPayload
  | TaskStatusChangedEventPayload;

@Injectable()
export class TasksEventsClient {
  constructor(
    @Inject(TASK_EVENTS_STRATEGY)
    private readonly events: IEventStrategy<TaskDomainEventPayload>,
  ) {}

  async emitTaskCreated(taskId: string, projectId?: string | null) {
    const payload: TaskCreatedEventPayload = {
      eventName: TASK_CREATED_EVENT,
      taskId,
      projectId: projectId ?? null,
      occurredAt: new Date().toISOString(),
    };

    await this.events.emitAsync(TASK_CREATED_EVENT, payload);
  }

  async emitTaskStatusChanged(taskId: string, status: string) {
    const payload: TaskStatusChangedEventPayload = {
      eventName: TASK_STATUS_CHANGED_EVENT,
      taskId,
      status,
      occurredAt: new Date().toISOString(),
    };

    await this.events.emitAsync(TASK_STATUS_CHANGED_EVENT, payload);
  }
}
