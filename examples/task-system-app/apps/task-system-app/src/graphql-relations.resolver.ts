import { BadRequestException } from '@nestjs/common';
import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CrudGenError } from '@nestjs-yalc/crud-gen/crud-gen.error';
import { TaskAppOmniEventService } from './omni-task-app/task-app-omni-event.service';
import { TaskAppOmniProjectService } from './omni-task-app/task-app-omni-project.service';
import { TaskAppOmniSyncStateService } from './omni-task-app/task-app-omni-sync-state.service';
import { TaskAppOmniTaskService } from './omni-task-app/task-app-omni-task.service';
import {
  TaskAppJoinTypes,
  TaskEventCondition,
  TaskEventCreateInput,
  TaskEventGridType,
  TaskEventType,
  TaskEventUpdateInput,
  TaskItemCondition,
  TaskItemCreateInput,
  TaskItemGridType,
  TaskItemSortModel,
  TaskItemType,
  TaskItemTypeFilterExpressionInput,
  TaskItemTypeJoinOptionsInputType,
  TaskItemUpdateInput,
  TaskProjectCondition,
  TaskProjectCreateInput,
  TaskProjectGridType,
  TaskProjectType,
  TaskProjectUpdateInput,
  TaskSyncStateCondition,
  TaskSyncStateCreateInput,
  TaskSyncStateGridType,
  TaskSyncStateType,
  TaskSyncStateUpdateInput,
} from './omni-task-app/task-app.types';

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

@Resolver()
export class TaskSystemGraphqlResolver {
  constructor(
    private readonly projectService: TaskAppOmniProjectService,
    private readonly taskService: TaskAppOmniTaskService,
    private readonly eventService: TaskAppOmniEventService,
    private readonly syncStateService: TaskAppOmniSyncStateService,
  ) {}

  @Mutation(() => TaskProjectType, { name: 'TaskSystem_createTaskProject' })
  async createTaskProject(@Args('input') input: TaskProjectCreateInput) {
    return this.projectService.create(input);
  }

  @Mutation(() => TaskItemType, { name: 'TaskSystem_createTaskItem' })
  async createTaskItem(@Args('input') input: TaskItemCreateInput) {
    return this.taskService.create(input);
  }

  @Mutation(() => TaskEventType, { name: 'TaskSystem_createTaskEvent' })
  async createTaskEvent(@Args('input') input: TaskEventCreateInput) {
    return this.eventService.create(input);
  }

  @Mutation(() => TaskSyncStateType, { name: 'TaskSystem_createTaskSyncState' })
  async createTaskSyncState(@Args('input') input: TaskSyncStateCreateInput) {
    return this.syncStateService.create(input);
  }

  @Mutation(() => TaskProjectType, { name: 'TaskSystem_updateTaskProject' })
  async updateTaskProject(
    @Args('conditions') conditions: TaskProjectCondition,
    @Args('input') input: TaskProjectUpdateInput,
  ) {
    return this.projectService.update(
      this.requireGuid(conditions, 'TaskProjectCondition'),
      input,
    );
  }

  @Mutation(() => TaskItemType, { name: 'TaskSystem_updateTaskItem' })
  async updateTaskItem(
    @Args('conditions') conditions: TaskItemCondition,
    @Args('input') input: TaskItemUpdateInput,
  ) {
    return this.taskService.update(
      this.requireGuid(conditions, 'TaskItemCondition'),
      input,
    );
  }

  @Mutation(() => TaskEventType, { name: 'TaskSystem_updateTaskEvent' })
  async updateTaskEvent(
    @Args('conditions') conditions: TaskEventCondition,
    @Args('input') input: TaskEventUpdateInput,
  ) {
    return this.eventService.update(
      this.requireGuid(conditions, 'TaskEventCondition'),
      input,
    );
  }

  @Mutation(() => TaskSyncStateType, {
    name: 'TaskSystem_updateTaskSyncState',
  })
  async updateTaskSyncState(
    @Args('conditions') conditions: TaskSyncStateCondition,
    @Args('input') input: TaskSyncStateUpdateInput,
  ) {
    return this.syncStateService.update(
      this.requireGuid(conditions, 'TaskSyncStateCondition'),
      input,
    );
  }

  @Mutation(() => Boolean, { name: 'TaskSystem_deleteTaskProject' })
  async deleteTaskProject(
    @Args('conditions') conditions: TaskProjectCondition,
  ) {
    await this.projectService.delete(
      this.requireGuid(conditions, 'TaskProjectCondition'),
    );
    return true;
  }

  @Mutation(() => Boolean, { name: 'TaskSystem_deleteTaskItem' })
  async deleteTaskItem(@Args('conditions') conditions: TaskItemCondition) {
    await this.taskService.delete(
      this.requireGuid(conditions, 'TaskItemCondition'),
    );
    return true;
  }

  @Mutation(() => Boolean, { name: 'TaskSystem_deleteTaskEvent' })
  async deleteTaskEvent(@Args('conditions') conditions: TaskEventCondition) {
    await this.eventService.delete(
      this.requireGuid(conditions, 'TaskEventCondition'),
    );
    return true;
  }

  @Mutation(() => Boolean, { name: 'TaskSystem_deleteTaskSyncState' })
  async deleteTaskSyncState(
    @Args('conditions') conditions: TaskSyncStateCondition,
  ) {
    await this.syncStateService.delete(
      this.requireGuid(conditions, 'TaskSyncStateCondition'),
    );
    return true;
  }

  @Query(() => TaskProjectType, { name: 'TaskSystem_getTaskProject' })
  async getTaskProject(@Args('ID') id: string) {
    return this.projectService.getById(id);
  }

  @Query(() => TaskItemType, { name: 'TaskSystem_getTaskItem' })
  async getTaskItem(@Args('ID') id: string) {
    return this.taskService.getById(id);
  }

  @Query(() => TaskEventType, { name: 'TaskSystem_getTaskEvent' })
  async getTaskEvent(@Args('ID') id: string) {
    return this.eventService.getById(id);
  }

  @Query(() => TaskSyncStateType, { name: 'TaskSystem_getTaskSyncState' })
  async getTaskSyncState(@Args('ID') id: string) {
    return this.syncStateService.getById(id);
  }

  @Query(() => TaskProjectGridType, { name: 'TaskSystem_getTaskProjectGrid' })
  async getTaskProjectGrid(
    @Args('startRow', { nullable: true }) startRow?: number,
    @Args('endRow', { nullable: true }) endRow?: number,
  ) {
    return this.projectService.list({ startRow, endRow });
  }

  @Query(() => TaskItemGridType, { name: 'TaskSystem_getTaskItemGrid' })
  async getTaskItemGrid(
    @Args('join', {
      nullable: true,
      type: () => TaskItemTypeJoinOptionsInputType,
    })
    join?: TaskItemTypeJoinOptionsInputType,
    @Args('sorting', { nullable: true, type: () => [TaskItemSortModel] })
    sorting?: TaskItemSortModel[],
    @Args('startRow', { nullable: true }) startRow?: number,
    @Args('endRow', { nullable: true }) endRow?: number,
    @Args('filters', {
      nullable: true,
      type: () => TaskItemTypeFilterExpressionInput,
    })
    filters?: TaskItemTypeFilterExpressionInput,
  ) {
    if (filters) {
      throw new CrudGenError(
        'Structured GraphQL filters require an extended repository; plain TypeORM fallback only supports basic grid queries.',
      );
    }

    if (
      join?.project?.joinType &&
      !Object.values(TaskAppJoinTypes).includes(join.project.joinType)
    ) {
      throw new CrudGenError('Invalid join type');
    }

    const page = await this.taskService.list({ startRow, endRow, sorting });
    const nodes = [...page.nodes];

    if (sorting?.length) {
      nodes.sort((a, b) => {
        for (const sort of sorting) {
          const direction = sort.sort === 'DESC' ? -1 : 1;
          const av = (a as unknown as Record<string, unknown>)[sort.colId];
          const bv = (b as unknown as Record<string, unknown>)[sort.colId];
          const avMissing = av === null || av === undefined;
          const bvMissing = bv === null || bv === undefined;
          if (avMissing && bvMissing) continue;
          if (avMissing) return -1 * direction;
          if (bvMissing) return 1 * direction;
          if (av < bv) return -1 * direction;
          if (av > bv) return 1 * direction;
        }
        return 0;
      });
    }

    const safeStart = startRow ?? 0;
    const safeEnd = endRow ?? nodes.length;
    const pagedNodes = nodes.slice(safeStart, safeEnd);

    return {
      pageData: {
        count: page.pageData.count,
        startRow: safeStart,
        endRow: safeStart + pagedNodes.length,
      },
      nodes: pagedNodes,
    };
  }

  @Query(() => TaskEventGridType, { name: 'TaskSystem_getTaskEventGrid' })
  async getTaskEventGrid(
    @Args('startRow', { nullable: true }) startRow?: number,
    @Args('endRow', { nullable: true }) endRow?: number,
  ) {
    return this.eventService.list({ startRow, endRow });
  }

  @Query(() => TaskSyncStateGridType, {
    name: 'TaskSystem_getTaskSyncStateGrid',
  })
  async getTaskSyncStateGrid(
    @Args('startRow', { nullable: true }) startRow?: number,
    @Args('endRow', { nullable: true }) endRow?: number,
  ) {
    return this.syncStateService.list({ startRow, endRow });
  }

  private requireGuid(
    conditions: { guid?: string | null },
    inputName: string,
  ): string {
    if (!conditions.guid) {
      throw new BadRequestException(
        `${inputName}.guid is required for this operation`,
      );
    }

    return conditions.guid;
  }
}
