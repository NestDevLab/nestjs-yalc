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
import { TaskAppOmniEventService } from '../omni-task-app/task-app-omni-event.service';
import { TaskEventCreateInput } from '../omni-task-app/task-app.types';

@Controller('events')
export class EventsController {
  constructor(private readonly events: TaskAppOmniEventService) {}

  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    return this.events.list(query);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.events.getById(id);
  }

  @Post()
  async create(@Body() body: Partial<TaskEventCreateInput>) {
    return this.events.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<TaskEventCreateInput>,
  ) {
    return this.events.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.events.delete(id);
  }
}
