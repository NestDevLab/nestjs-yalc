import { Inject, Injectable } from '@nestjs/common';
import type { IApiCallStrategy } from '@nestjs-yalc/api-strategy';

@Injectable()
export class TasksProxyService {
  constructor(
    @Inject('TASKS_HTTP_STRATEGY') private readonly http: IApiCallStrategy,
  ) {}

  async listTasks() {
    const res = await this.http.get('/tasks');
    return res.data;
  }
}
