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
import { TaskProject } from '@nestjs-yalc/task-system-module';
import { TaskAppOmniProjectService } from '../omni-task-app/task-app-omni-project.service';
import { TaskAppOmniTaskService } from '../omni-task-app/task-app-omni-task.service';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projects: TaskAppOmniProjectService,
    private readonly tasks: TaskAppOmniTaskService,
  ) {}

  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    return this.projects.list(query);
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @Query('includeTasks') includeTasks?: string,
  ) {
    const project = await this.projects.getById(id);
    if (includeTasks !== 'true') {
      return project;
    }

    return {
      ...project,
      tasks: (await this.tasks.list({ projectId: id })).list,
    };
  }

  @Get(':id/tasks')
  async listTasks(
    @Param('id') id: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.tasks.list({
      ...query,
      projectId: id,
    });
  }

  @Post()
  async create(@Body() body: Partial<TaskProject>) {
    return this.projects.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: Partial<TaskProject>) {
    return this.projects.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.projects.delete(id);
  }
}
