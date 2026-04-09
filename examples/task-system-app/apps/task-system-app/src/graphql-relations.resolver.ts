import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { TaskEventType } from './events/task-event.dto';
import { TaskAppOmniEventService } from './omni-task-app/task-app-omni-event.service';
import { TaskAppOmniProjectService } from './omni-task-app/task-app-omni-project.service';
import { TaskAppOmniTaskService } from './omni-task-app/task-app-omni-task.service';
import { TaskProjectType } from './projects/task-project.dto';
import { TaskItemType } from './tasks/task-item.dto';

@Resolver(() => TaskItemType)
export class TaskItemRelationsResolver {
  constructor(private readonly projectService: TaskAppOmniProjectService) {}

  @ResolveField(() => TaskProjectType, { nullable: true })
  async project(@Parent() task: TaskItemType) {
    if (!task.projectId) return null;
    return this.projectService.getById(task.projectId);
  }
}

@Resolver(() => TaskEventType)
export class TaskEventRelationsResolver {
  constructor(private readonly projectService: TaskAppOmniProjectService) {}

  @ResolveField(() => TaskProjectType, { nullable: true })
  async project(@Parent() event: TaskEventType) {
    if (!event.projectId) return null;
    return this.projectService.getById(event.projectId);
  }
}

@Resolver(() => TaskProjectType)
export class TaskProjectRelationsResolver {
  constructor(
    private readonly taskService: TaskAppOmniTaskService,
    private readonly eventService: TaskAppOmniEventService,
  ) {}

  @ResolveField(() => [TaskItemType], { nullable: true })
  async tasks(@Parent() project: TaskProjectType) {
    return (await this.taskService.list({ projectId: project.guid })).nodes;
  }

  @ResolveField(() => [TaskEventType], { nullable: true })
  async events(@Parent() project: TaskProjectType) {
    return (await this.eventService.list({ projectId: project.guid })).nodes;
  }
}
