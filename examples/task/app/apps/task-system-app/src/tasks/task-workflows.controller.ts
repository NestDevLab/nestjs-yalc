import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { TaskWorkflowsService } from './task-workflows.service';
import type { CreateProjectWithTaskPayload } from './task-workflows.service';

@Controller('task-workflows')
export class TaskWorkflowsController {
  constructor(private readonly service: TaskWorkflowsService) {}

  @Get('backlog')
  async getBacklog() {
    return this.service.getBacklog();
  }

  @Post('project-with-task')
  async createProjectWithTask(@Body() payload: CreateProjectWithTaskPayload) {
    return this.service.createProjectWithTask(payload);
  }

  @Put('tasks/:id/complete')
  async completeTask(@Param('id') id: string) {
    return this.service.completeTask(id);
  }

  @Get('projects/:projectId/tasks')
  async listProjectTasks(@Param('projectId') projectId: string) {
    return this.service.listProjectTasks(projectId);
  }
}
