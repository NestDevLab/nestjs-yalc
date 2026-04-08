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
import { TaskAppOmniSyncStateService } from '../omni-task-app/task-app-omni-sync-state.service';
import { TaskSyncStateCreateInput } from '../omni-task-app/task-app.types';

@Controller('sync-states')
export class SyncStatesController {
  constructor(private readonly syncStates: TaskAppOmniSyncStateService) {}

  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    return this.syncStates.list(query);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.syncStates.getById(id);
  }

  @Post()
  async create(@Body() body: Partial<TaskSyncStateCreateInput>) {
    return this.syncStates.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<TaskSyncStateCreateInput>,
  ) {
    return this.syncStates.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.syncStates.delete(id);
  }
}
