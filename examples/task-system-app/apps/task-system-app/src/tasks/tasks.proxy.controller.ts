import { Controller, Get } from '@nestjs/common';
import { TasksProxyService } from './tasks.proxy.service';

@Controller('tasks-proxy')
export class TasksProxyController {
  constructor(private readonly service: TasksProxyService) {}

  @Get()
  async listTasks() {
    return this.service.listTasks();
  }
}
