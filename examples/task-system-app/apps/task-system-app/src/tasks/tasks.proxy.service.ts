import { Inject, Injectable } from '@nestjs/common';
import { IHttpCallStrategy } from '@nestjs-yalc/api-strategy';

@Injectable()
export class TasksProxyService {
  constructor(
    @Inject('TASKS_HTTP_STRATEGY') private readonly http: IHttpCallStrategy,
  ) {}

  async listTasks() {
    const res = await this.http.get('/tasks');
    return res.data;
  }
}
