import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { TaskItem } from '@nestjs-yalc/task-system-module';
import { TaskAppOmniTaskService } from '../omni-task-app/task-app-omni-task.service';
import { type TaskItemOmniWriteInput } from '../omni-task-app/task-app-omni.mapper';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TaskAppOmniTaskService) {}

  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    return this.tasks.list(query);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.tasks.getById(id);
  }

  @Post()
  async create(@Body() body: TaskItemOmniWriteInput & Partial<TaskItem>) {
    return this.tasks.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: TaskItemOmniWriteInput & Partial<TaskItem>,
  ) {
    return this.tasks.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.tasks.delete(id);
  }
}
