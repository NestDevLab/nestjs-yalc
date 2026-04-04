import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TaskEvent,
  TaskEventType,
  TaskItem,
  TaskItemType,
  TaskProject,
  TaskProjectType,
} from '@nestjs-yalc/task-system-module';

@Resolver(() => TaskItemType)
export class TaskItemRelationsResolver {
  constructor(
    @InjectRepository(TaskProject)
    private readonly projectRepository: Repository<TaskProject>,
  ) {}

  @ResolveField(() => TaskProjectType, { nullable: true })
  async project(@Parent() task: TaskItem) {
    if (!task.projectId) return null;
    const project = await this.projectRepository.findOneBy({ guid: task.projectId });
    return project ? new TaskProjectType(project) : null;
  }
}

@Resolver(() => TaskEventType)
export class TaskEventRelationsResolver {
  constructor(
    @InjectRepository(TaskProject)
    private readonly projectRepository: Repository<TaskProject>,
  ) {}

  @ResolveField(() => TaskProjectType, { nullable: true })
  async project(@Parent() event: TaskEvent) {
    if (!event.projectId) return null;
    const project = await this.projectRepository.findOneBy({ guid: event.projectId });
    return project ? new TaskProjectType(project) : null;
  }
}

@Resolver(() => TaskProjectType)
export class TaskProjectRelationsResolver {
  constructor(
    @InjectRepository(TaskItem)
    private readonly taskRepository: Repository<TaskItem>,
    @InjectRepository(TaskEvent)
    private readonly eventRepository: Repository<TaskEvent>,
  ) {}

  @ResolveField(() => [TaskItemType], { nullable: true })
  async tasks(@Parent() project: TaskProject) {
    const tasks = await this.taskRepository.findBy({ projectId: project.guid });
    return tasks.map((task) => new TaskItemType(task));
  }

  @ResolveField(() => [TaskEventType], { nullable: true })
  async events(@Parent() project: TaskProject) {
    const events = await this.eventRepository.findBy({ projectId: project.guid });
    return events.map((event) => new TaskEventType(event));
  }
}
