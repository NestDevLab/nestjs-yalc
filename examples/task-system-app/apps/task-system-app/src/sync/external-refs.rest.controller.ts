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
import { TaskAppOmniExternalRefService } from '../omni-task-app/task-app-omni-external-ref.service';
import { TaskExternalRefCreateInput } from '../omni-task-app/task-app.types';

@Controller('external-refs')
export class ExternalRefsController {
  constructor(private readonly externalRefs: TaskAppOmniExternalRefService) {}

  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    return this.externalRefs.list(query);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.externalRefs.getById(id);
  }

  @Post()
  async create(@Body() body: Partial<TaskExternalRefCreateInput>) {
    return this.externalRefs.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<TaskExternalRefCreateInput>,
  ) {
    return this.externalRefs.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.externalRefs.delete(id);
  }
}
