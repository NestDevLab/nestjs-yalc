import { Inject, Injectable } from '@nestjs/common';
import type { IHttpCallStrategy } from '@nestjs-yalc/api-strategy';
import type {
  TaskProjectCreateInput,
  TaskProjectType,
} from '../task-project.dto.js';
import type {
  TaskItemCreateInput,
  TaskItemType,
  TaskItemUpdateInput,
} from '../task-item.dto.js';

export const TASKS_CLIENT_API_STRATEGY = 'TASKS_CLIENT_API_STRATEGY';
export const TASKS_CLIENT_LOCAL_API_STRATEGY =
  'TASKS_CLIENT_LOCAL_API_STRATEGY';
export const TASKS_CLIENT_HTTP_API_STRATEGY = 'TASKS_CLIENT_HTTP_API_STRATEGY';

export type TaskClientQuery = Record<
  string,
  string | number | boolean | undefined
>;

type EmptyQuery = Record<string, never>;

export interface TaskClientPageData {
  startRow: number;
  count: number;
  [key: string]: unknown;
}

export interface TaskClientListResponse<TItem> {
  list: TItem[];
  pageData: TaskClientPageData;
}

@Injectable()
export class TasksApiClient {
  constructor(
    @Inject(TASKS_CLIENT_API_STRATEGY)
    private readonly api: IHttpCallStrategy,
  ) {}

  async listTasks(query: TaskClientQuery = {}) {
    const res = await this.api.get<
      never,
      TaskClientQuery,
      TaskClientListResponse<TaskItemType>
    >('/tasks', { parameters: query });
    return res.data;
  }

  async listProjectTasks(projectId: string) {
    return this.listTasks({ projectId });
  }

  async getTask(taskId: string) {
    const res = await this.api.get<never, EmptyQuery, TaskItemType>(
      `/tasks/${taskId}`,
    );
    return res.data;
  }

  async createTask(payload: TaskItemCreateInput) {
    const res = await this.api.post<
      TaskItemCreateInput,
      EmptyQuery,
      TaskItemType
    >('/tasks', { data: payload });
    return res.data;
  }

  async updateTask(taskId: string, payload: TaskItemUpdateInput) {
    const res = await this.api.call<
      TaskItemUpdateInput,
      EmptyQuery,
      TaskItemType
    >(`/tasks/${taskId}`, {
      method: 'PUT',
      data: payload,
    });
    return res.data;
  }

  async createProject(payload: TaskProjectCreateInput) {
    const res = await this.api.post<
      TaskProjectCreateInput,
      EmptyQuery,
      TaskProjectType
    >('/projects', { data: payload });
    return res.data;
  }
}
