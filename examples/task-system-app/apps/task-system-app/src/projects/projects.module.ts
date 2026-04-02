import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.rest.controller';

@Module({
  controllers: [ProjectsController],
})
export class ProjectsModule {}
