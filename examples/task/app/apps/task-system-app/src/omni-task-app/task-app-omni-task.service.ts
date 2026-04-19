import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CrudGenFindManyOptions } from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interface';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import { randomUUID } from 'node:crypto';
import {
  OmniRecordEntity,
  OmniRelationEntity,
  OmniRelationKind,
  OmniRelationStatus,
} from '@nestjs-yalc/omnikernel-module';
import { TaskItem } from '@nestjs-yalc/task-system-module/src/task-item.entity';
import { DeepPartial, FindOperator, In, Repository } from 'typeorm';
import {
  TaskAppOmniMapper,
  type TaskItemOmniWriteInput,
  type TaskOmniPageQuery,
} from './task-app-omni.mapper';
import { TaskItemCreateInput, TaskItemType } from '../tasks/task-item.dto';
import { TaskAppOmniProjectService } from './task-app-omni-project.service';

type TaskListQuery = TaskOmniPageQuery & {
  sorting?: Array<{ colId: string; sort?: 'ASC' | 'DESC' }>;
};

@Injectable()
export class TaskAppOmniTaskService {
  constructor(
    @InjectRepository(OmniRecordEntity)
    private readonly recordRepository: Repository<OmniRecordEntity>,
    @InjectRepository(OmniRelationEntity)
    private readonly relationRepository: Repository<OmniRelationEntity>,
    private readonly events: YalcEventService,
    private readonly mapper: TaskAppOmniMapper,
    private readonly projectService: TaskAppOmniProjectService,
  ) {}

  supportsStructuredGraphqlFilters() {
    return false;
  }

  async list(query: TaskListQuery = {}) {
    const pagination = this.mapper.parsePageQuery(query);
    const order = this.buildRecordOrder(query.sorting);
    const [tasks, count] = await this.findTasks(
      { projectId: query.projectId },
      pagination.skip,
      pagination.take,
      order ?? { createdAt: 'ASC' },
    );

    return this.mapper.buildPage(tasks, pagination.startRow, count);
  }

  async getById(guid: string): Promise<TaskItemType> {
    return this.getTaskItemOrFail(guid);
  }

  async create(input: TaskItemOmniWriteInput): Promise<TaskItemType> {
    return this.createEntity(input) as Promise<TaskItemType>;
  }

  async update(
    guid: string,
    input: TaskItemOmniWriteInput,
  ): Promise<TaskItemType> {
    return this.updateEntity({ guid }, input) as Promise<TaskItemType>;
  }

  async delete(guid: string) {
    await this.deleteEntity({ guid });
    return { deleted: true };
  }

  async getEntity(
    where: Partial<TaskItem> | Partial<TaskItem>[] | string,
    _fields?: (keyof TaskItem)[],
    _relations?: string[],
    _databaseName?: string,
    options?: {
      failOnNull?: boolean;
    },
  ): Promise<TaskItemType | null | undefined> {
    const normalized = this.normalizeCrudGenWhere(where);
    const [tasks] = await this.findTasks(normalized, 0, 1, {
      createdAt: 'ASC',
    });
    const task = tasks[0];

    if (!task) {
      if (options?.failOnNull) {
        throw this.events.errorNotFound('tasks.omni.not-found', {
          data: { conditions: where },
          response: { message: 'Task not found' },
        });
      }

      return null;
    }

    return task;
  }

  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<TaskItem>,
    withCount?: false,
  ): Promise<TaskItemType[]>;
  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<TaskItem>,
    withCount: true,
  ): Promise<[TaskItemType[], number]>;
  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<TaskItem>,
    withCount = false,
  ): Promise<[TaskItemType[], number] | TaskItemType[]> {
    const normalized = this.normalizeCrudGenWhere(
      findOptions.where as Partial<TaskItem> | undefined,
    );
    const tasks = await this.findTasks(
      normalized,
      findOptions.skip ?? 0,
      findOptions.take,
      (findOptions.order as Record<string, 'ASC' | 'DESC'> | undefined) ?? {
        createdAt: 'ASC',
      },
    );

    if (!withCount) {
      return tasks[0];
    }

    return tasks;
  }

  async createEntity(
    input: DeepPartial<TaskItem>,
    _findOptions?: CrudGenFindManyOptions<TaskItem>,
    returnEntity = true,
  ): Promise<TaskItemType | boolean> {
    if (!input.guid || !input.title) {
      throw this.events.errorBadRequest('tasks.omni.create.invalid', {
        data: {
          guid: input.guid ?? null,
          title: input.title ?? null,
        },
        response: {
          message: 'Task guid and title are required',
        },
      });
    }

    if (input.projectId) {
      await this.projectService.ensureProjectExists(input.projectId);
    }

    const createInput: TaskItemOmniWriteInput = {
      description: input.description,
      dueAt: input.dueAt as Date | null | undefined,
      guid: input.guid,
      projectId: input.projectId,
      referenceIds: (input as TaskItemOmniWriteInput).referenceIds,
      relatedToIds: (input as TaskItemOmniWriteInput).relatedToIds,
      status: input.status,
      title: input.title,
    };

    const record = this.recordRepository.create(
      this.mapper.mapTaskToOmniRecord(createInput),
    );
    await this.recordRepository.save(record);
    await this.syncContainsRelation(record.guid, input.projectId ?? null);
    await this.syncTaskRelations(
      record.guid,
      OmniRelationKind.References,
      createInput.referenceIds,
    );
    await this.syncTaskRelations(
      record.guid,
      OmniRelationKind.RelatedTo,
      createInput.relatedToIds,
    );

    if (!returnEntity) {
      return true;
    }

    return this.getTaskItemOrFail(record.guid);
  }

  async updateEntity(
    conditions: Partial<TaskItem>,
    input: DeepPartial<TaskItem>,
    _findOptions?: CrudGenFindManyOptions<TaskItem>,
    returnEntity = true,
  ): Promise<TaskItemType | boolean> {
    const guid = this.requireGuid(conditions);
    const current = await this.getTaskItemOrFail(guid);

    const merged: TaskItemOmniWriteInput = {
      description:
        input.description !== undefined
          ? input.description
          : (current.description ?? null),
      dueAt:
        input.dueAt !== undefined
          ? (input.dueAt as Date | null)
          : (current.dueAt ?? null),
      guid,
      projectId: Object.prototype.hasOwnProperty.call(input, 'projectId')
        ? (input.projectId ?? null)
        : (current.projectId ?? null),
      referenceIds: (input as TaskItemOmniWriteInput).referenceIds,
      relatedToIds: (input as TaskItemOmniWriteInput).relatedToIds,
      status: input.status ?? current.status,
      title: input.title ?? current.title,
    };

    await this.recordRepository.update(
      { guid, kind: this.mapper.taskKind },
      this.mapper.mapTaskToOmniRecord(merged),
    );

    if (Object.prototype.hasOwnProperty.call(input, 'projectId')) {
      if (input.projectId) {
        await this.projectService.ensureProjectExists(input.projectId);
      }
      await this.syncContainsRelation(guid, input.projectId ?? null);
    }

    if ((input as TaskItemOmniWriteInput).referenceIds) {
      await this.syncTaskRelations(
        guid,
        OmniRelationKind.References,
        (input as TaskItemOmniWriteInput).referenceIds,
      );
    }

    if ((input as TaskItemOmniWriteInput).relatedToIds) {
      await this.syncTaskRelations(
        guid,
        OmniRelationKind.RelatedTo,
        (input as TaskItemOmniWriteInput).relatedToIds,
      );
    }

    if (!returnEntity) {
      return true;
    }

    return this.getTaskItemOrFail(guid);
  }

  async deleteEntity(conditions: Partial<TaskItem>): Promise<boolean> {
    const guid = this.requireGuid(conditions);
    await this.getTaskRecordOrFail(guid);
    await this.relationRepository.delete({ sourceRecordId: guid });
    await this.relationRepository.delete({ targetRecordId: guid });
    await this.recordRepository.delete({
      guid,
      kind: this.mapper.taskKind,
    });
    return true;
  }

  async ensureTaskExists(guid: string): Promise<void> {
    await this.getTaskRecordOrFail(guid);
  }

  private async getTaskRecordOrFail(guid: string) {
    const record = await this.recordRepository.findOne({
      where: {
        guid,
        kind: this.mapper.taskKind,
      },
    });

    if (!record) {
      throw this.events.errorNotFound('tasks.omni.not-found', {
        data: {
          taskId: guid,
        },
        response: {
          message: 'Task not found',
        },
      });
    }

    return record;
  }

  private async getTaskItemOrFail(guid: string) {
    const record = await this.getTaskRecordOrFail(guid);
    const projectId = await this.getProjectIdForTask(guid);
    return this.mapper.mapOmniRecordToTask(record, projectId);
  }

  private async findTasks(
    where: {
      guid?: string | FindOperator<string>;
      projectId?: string | FindOperator<string> | null;
      title?: string | FindOperator<string>;
    },
    skip: number,
    take: number | undefined,
    order: Record<string, 'ASC' | 'DESC'>,
  ): Promise<[TaskItemType[], number]> {
    const projectId = this.unwrapScalarCondition(where.projectId);

    if (typeof projectId === 'string' && projectId.length > 0) {
      await this.projectService.ensureProjectExists(projectId);
      const [records, count] = await this.getCollectionMembersByKind(
        projectId,
        this.mapper.taskKind,
        skip,
        take ?? 100,
        order,
      );

      return [
        records.map((record) =>
          this.mapper.mapOmniRecordToTask(record, projectId),
        ),
        count,
      ];
    }

    const recordWhere = {
      kind: this.mapper.taskKind,
      ...(where.guid !== undefined ? { guid: where.guid } : {}),
      ...(where.title !== undefined ? { title: where.title } : {}),
    };

    const [records, count] = await this.recordRepository.findAndCount({
      order,
      skip,
      take,
      where: recordWhere,
    });

    const projectIds = await this.getProjectIds(
      records.map((record) => record.guid),
    );

    return [
      records.map((record) =>
        this.mapper.mapOmniRecordToTask(
          record,
          projectIds.get(record.guid) ?? null,
        ),
      ),
      count,
    ];
  }

  private async getCollectionMembersByKind(
    collectionId: string,
    recordKind: string,
    skip: number,
    take: number,
    order: Record<string, 'ASC' | 'DESC'> = { createdAt: 'ASC' },
  ): Promise<[OmniRecordEntity[], number]> {
    const baseQuery = this.relationRepository
      .createQueryBuilder('relation')
      .innerJoinAndSelect('relation.targetRecord', 'targetRecord')
      .where('relation.sourceRecordId = :collectionId', { collectionId })
      .andWhere('relation.kind = :relationKind', {
        relationKind: OmniRelationKind.Contains,
      })
      .andWhere('relation.status = :relationStatus', {
        relationStatus: OmniRelationStatus.Active,
      })
      .andWhere('targetRecord.kind = :recordKind', { recordKind });

    const count = await baseQuery.clone().getCount();
    const sortableColumns = new Set(['guid', 'title', 'slug', 'createdAt']);
    let orderedQuery = baseQuery;

    for (const [column, direction] of Object.entries(order)) {
      if (!sortableColumns.has(column)) {
        continue;
      }

      orderedQuery = orderedQuery.addOrderBy(
        `targetRecord.${column}`,
        direction,
      );
    }

    if (Object.keys(order).length === 0) {
      orderedQuery = orderedQuery.orderBy('relation.createdAt', 'ASC');
    }

    const relations = await orderedQuery.skip(skip).take(take).getMany();

    return [
      relations
        .map((relation) => relation.targetRecord)
        .filter((record): record is OmniRecordEntity => !!record),
      count,
    ];
  }

  private buildRecordOrder(
    sorting?: Array<{ colId: string; sort?: 'ASC' | 'DESC' }>,
  ) {
    if (!sorting?.length) {
      return null;
    }

    const order: Record<string, 'ASC' | 'DESC'> = {};
    const sortableColumns = new Set(['guid', 'title', 'slug', 'createdAt']);

    for (const sort of sorting) {
      if (!sortableColumns.has(sort.colId)) {
        continue;
      }

      order[sort.colId] = sort.sort === 'DESC' ? 'DESC' : 'ASC';
    }

    return Object.keys(order).length > 0 ? order : null;
  }

  private requireGuid(conditions: Partial<TaskItem>) {
    if (!conditions.guid) {
      throw this.events.errorBadRequest('tasks.omni.conditions.invalid', {
        response: { message: 'Task guid is required' },
      });
    }

    return conditions.guid;
  }

  private normalizeCrudGenWhere(
    where?: Partial<TaskItem> | Partial<TaskItem>[] | string,
  ) {
    if (!where) {
      return {};
    }

    if (typeof where === 'string') {
      return { guid: where };
    }

    if (Array.isArray(where)) {
      return this.normalizeCrudGenWhere(where[0]);
    }

    const filters = this.mapper.extractCrudGenFilterMap(where);

    const guid = filters.guid as string | FindOperator<string> | undefined;
    const projectId = filters.projectId as
      | string
      | FindOperator<string>
      | undefined;
    const title = filters.title as string | FindOperator<string> | undefined;

    return {
      ...(guid instanceof FindOperator
        ? this.mapGuidFindOperator(guid)
        : guid
          ? { guid }
          : {}),
      ...(projectId instanceof FindOperator
        ? this.mapProjectIdFindOperator(projectId)
        : projectId
          ? { projectId }
          : {}),
      ...(title instanceof FindOperator
        ? this.mapTitleFindOperator(title)
        : title
          ? { title }
          : {}),
    };
  }

  private mapGuidFindOperator(guid: FindOperator<string>) {
    if (guid.type === 'in' && Array.isArray(guid.value)) {
      return {
        guid: In(guid.value as string[]),
      };
    }

    return { guid };
  }

  private mapProjectIdFindOperator(projectId: FindOperator<string>) {
    if (projectId.type === 'in' && Array.isArray(projectId.value)) {
      return {
        projectId: In(projectId.value as string[]),
      };
    }

    return { projectId };
  }

  private mapTitleFindOperator(title: FindOperator<string>) {
    return { title };
  }

  private unwrapScalarCondition(
    value?: string | FindOperator<string> | null,
  ): string | null {
    if (!value) {
      return null;
    }

    if (value instanceof FindOperator) {
      if (value.type === 'equal' && typeof value.value === 'string') {
        return value.value;
      }

      return null;
    }

    return value;
  }

  private async getProjectIds(taskIds: string[]) {
    const projectIds = new Map<string, string | null>();

    if (taskIds.length === 0) {
      return projectIds;
    }

    const relations = await this.relationRepository.find({
      order: {
        createdAt: 'ASC',
      },
      where: {
        kind: OmniRelationKind.Contains,
        status: OmniRelationStatus.Active,
        targetRecordId: In(taskIds),
      },
    });

    for (const relation of relations) {
      if (!projectIds.has(relation.targetRecordId)) {
        projectIds.set(relation.targetRecordId, relation.sourceRecordId);
      }
    }

    return projectIds;
  }

  private async getProjectIdForTask(taskId: string) {
    const relation = await this.relationRepository.findOne({
      order: {
        createdAt: 'ASC',
      },
      where: {
        kind: OmniRelationKind.Contains,
        status: OmniRelationStatus.Active,
        targetRecordId: taskId,
      },
    });

    return relation?.sourceRecordId ?? null;
  }

  private async syncContainsRelation(taskId: string, projectId: string | null) {
    await this.relationRepository.delete({
      kind: OmniRelationKind.Contains,
      targetRecordId: taskId,
    });

    if (!projectId) {
      return;
    }

    await this.relationRepository.save(
      this.relationRepository.create({
        guid: randomUUID(),
        kind: OmniRelationKind.Contains,
        sourceRecordId: projectId,
        status: OmniRelationStatus.Active,
        targetRecordId: taskId,
      }),
    );
  }

  private async syncTaskRelations(
    taskId: string,
    relationKind: OmniRelationKind.References | OmniRelationKind.RelatedTo,
    targetIds?: string[],
  ) {
    if (!targetIds) {
      return;
    }

    await this.relationRepository.delete({
      kind: relationKind,
      sourceRecordId: taskId,
    });

    const uniqueTargetIds = [...new Set(targetIds.filter(Boolean))];
    if (uniqueTargetIds.length === 0) {
      return;
    }

    const targets = await this.recordRepository.find({
      where: {
        guid: In(uniqueTargetIds),
      },
    });

    if (targets.length !== uniqueTargetIds.length) {
      throw this.events.errorBadRequest('tasks.omni.relations.invalid-target', {
        data: {
          relationKind,
          sourceTaskId: taskId,
          targetIds: uniqueTargetIds,
        },
        response: {
          message: 'One or more related records do not exist',
        },
      });
    }

    await this.relationRepository.save(
      uniqueTargetIds.map((targetId) =>
        this.relationRepository.create({
          guid: randomUUID(),
          kind: relationKind,
          sourceRecordId: taskId,
          status: OmniRelationStatus.Active,
          targetRecordId: targetId,
        }),
      ),
    );
  }
}
