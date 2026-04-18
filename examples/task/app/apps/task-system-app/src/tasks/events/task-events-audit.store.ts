import { Injectable } from '@nestjs/common';
import type { TaskDomainEventPayload } from '@nestjs-yalc/task-system-module/src/events/tasks-events.client';

export interface RecordedTaskDomainEvent {
  eventName: string;
  source: 'local' | 'rabbitmq';
  payload: TaskDomainEventPayload;
}

@Injectable()
export class TaskEventsAuditStore {
  private readonly events: RecordedTaskDomainEvent[] = [];
  private readonly waiters = new Set<{
    predicate: (event: RecordedTaskDomainEvent) => boolean;
    resolve: (event: RecordedTaskDomainEvent) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  record(event: RecordedTaskDomainEvent) {
    this.events.push(event);

    for (const waiter of [...this.waiters]) {
      if (waiter.predicate(event)) {
        clearTimeout(waiter.timeout);
        this.waiters.delete(waiter);
        waiter.resolve(event);
      }
    }
  }

  list() {
    return [...this.events];
  }

  clear() {
    this.events.length = 0;
  }

  waitFor(
    predicate: (event: RecordedTaskDomainEvent) => boolean,
    timeoutMs = 5000,
  ) {
    const existing = this.events.find(predicate);
    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise<RecordedTaskDomainEvent>((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.waiters.delete(waiter);
          reject(new Error('Timed out waiting for task domain event.'));
        }, timeoutMs),
      };

      this.waiters.add(waiter);
    });
  }
}
