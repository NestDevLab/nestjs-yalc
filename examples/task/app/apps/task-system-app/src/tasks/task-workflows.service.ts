import { Injectable } from '@nestjs/common';
import { TelemetryService } from '@nestjs-yalc/observability';
import { TasksApiClient } from '@nestjs-yalc/task-system-module/src/client/tasks-api.client';
import type { TaskProjectCreateInput } from '../projects/task-project.dto';
import type { TaskItemCreateInput, TaskItemUpdateInput } from './task-item.dto';
import { TasksDomainEventsService } from './tasks.domain-events.service';

export interface CreateProjectWithTaskPayload {
  project: TaskProjectCreateInput;
  task: Omit<TaskItemCreateInput, 'projectId'> & {
    projectId?: string | null;
  };
}

@Injectable()
export class TaskWorkflowsService {
  constructor(
    private readonly client: TasksApiClient,
    private readonly events: TasksDomainEventsService,
    private readonly telemetry: TelemetryService,
  ) {}

  async getBacklog() {
    return this.telemetry.measure('task-workflows.backlog', async () => {
      const tasks = await this.client.listTasks();
      const backlog = tasks.list.filter((task) => task.status === 'todo');

      return {
        ...tasks,
        list: backlog,
        pageData: {
          ...tasks.pageData,
          count: backlog.length,
        },
      };
    });
  }

  async createProjectWithTask(payload: CreateProjectWithTaskPayload) {
    return this.telemetry.measure(
      'task-workflows.project-with-task',
      async () => {
        const project = await this.client.createProject(payload.project);
        const task = await this.client.createTask({
          ...payload.task,
          projectId: payload.task.projectId ?? project.guid,
        });

        await this.events.emitTaskCreated(
          task.guid,
          task.projectId ?? project.guid,
        );

        return { project, task };
      },
    );
  }

  async completeTask(taskId: string) {
    return this.telemetry.measure('task-workflows.complete-task', async () => {
      await this.client.updateTask(taskId, {
        status: 'done',
      } as TaskItemUpdateInput);

      const task = await this.client.getTask(taskId);
      await this.events.emitTaskStatusChanged(task.guid, task.status);

      return { task };
    });
  }

  async listProjectTasks(projectId: string) {
    return this.telemetry.measure('task-workflows.project-tasks', () =>
      this.client.listProjectTasks(projectId),
    );
  }
}
