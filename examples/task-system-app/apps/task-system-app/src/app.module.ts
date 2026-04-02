import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskSystemModule, TaskItem, TaskProject } from '@nestjs-yalc/task-system-module';
import { TasksModule } from './tasks/tasks.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      entities: [TaskItem, TaskProject],
      synchronize: true,
    }),
    TaskSystemModule.register('default'),
    TasksModule,
    ProjectsModule,
  ],
})
export class AppModule {}
