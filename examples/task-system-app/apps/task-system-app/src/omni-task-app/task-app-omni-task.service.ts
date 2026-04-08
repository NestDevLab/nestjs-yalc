import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import { randomUUID } from 'node:crypto';
import {
  OmniKernelQueryService,
  OmniRecordEntity,
  OmniRelationEntity,
  OmniRelationKind,
  OmniRelationStatus,
} from '@nestjs-yalc/omnikernel-module';
import { TaskItem, TaskItemType } from '@nestjs-yalc/task-system-module';
import { In, Repository } from 'typeorm';
import {
  TaskAppOmniMapper,
  type TaskItemOmniWriteInput,
  type TaskOmniPageQuery,
} from './task-app-omni.mapper';
import { TaskAppOmniProjectService } from './task-app-omni-project.service';

@Injectable()
export class TaskAppOmniTaskService {
  constructor(
    @InjectRepository(OmniRecordEntity)
    private readonly recordRepository: Repository<OmniRecordEntity>,
    @InjectRepository(OmniRelationEntity)
    private readonly relationRepository: Repository<OmniRelationEntity>,
    @InjectRepository(TaskItem)
    private readonly legacyTaskRepository: Repository<TaskItem>,
    private readonly events: YalcEventService,
    private readonly mapper: TaskAppOmniMapper,
    private readonly omniKernelQueryService: OmniKernelQueryService,
    private readonly projectService: TaskAppOmniProjectService,
  ) {}

  async list(query: TaskOmniPageQuery = {}) {
    const pagination = this.mapper.parsePageQuery(query);

    if (query.projectId) {
      await this.projectService.ensureProjectExists(query.projectId);
      const members = await this.omniKernelQueryService.getCollectionMembers(
        query.projectId,
      );
      const tasks = members.filter(
        (record): record is OmniRecordEntity =>
          record.kind === this.mapper.taskKind,
      );
      const paged = tasks.slice(
        pagination.startRow,
        pagination.startRow + pagination.take,
      );

      return this.mapper.buildPage(
        paged.map((task) =>
          this.mapper.mapOmniRecordToTask(task, query.projectId),
        ),
        pagination.startRow,
        tasks.length,
      );
    }

    const [records, count] = await this.recordRepository.findAndCount({
      order: {
        createdAt: 'ASC',
      },
      skip: pagination.skip,
      take: pagination.take,
      where: {
        kind: this.mapper.taskKind,
      },
    });

    const projectIds = await this.getProjectIds(
      records.map((record) => record.guid),
    );

    return this.mapper.buildPage(
      records.map((record) =>
        this.mapper.mapOmniRecordToTask(
          record,
          projectIds.get(record.guid) ?? null,
        ),
      ),
      pagination.startRow,
      count,
    );
  }

  async getById(guid: string): Promise<TaskItemType> {
    const record = await this.getTaskRecordOrFail(guid);
    const projectId = await this.getProjectIdForTask(guid);
    return this.mapper.mapOmniRecordToTask(record, projectId);
  }

  async create(input: TaskItemOmniWriteInput): Promise<TaskItemType> {
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

    const record = this.recordRepository.create(
      this.mapper.mapTaskToOmniRecord(input),
    );
    await this.recordRepository.save(record);
    await this.legacyTaskRepository.save(
      this.legacyTaskRepository.create({
        description: input.description ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        guid: input.guid,
        projectId: input.projectId ?? null,
        status: input.status ?? 'todo',
        title: input.title,
      }),
    );
    await this.syncContainsRelation(record.guid, input.projectId ?? null);
    await this.syncTaskRelations(
      record.guid,
      OmniRelationKind.References,
      input.referenceIds,
    );
    await this.syncTaskRelations(
      record.guid,
      OmniRelationKind.RelatedTo,
      input.relatedToIds,
    );

    return this.getById(record.guid);
  }

  async update(
    guid: string,
    input: TaskItemOmniWriteInput,
  ): Promise<TaskItemType> {
    const current = await this.getById(guid);

    const merged = {
      description:
        input.description !== undefined
          ? input.description
          : current.description ?? null,
      dueAt: input.dueAt !== undefined ? input.dueAt : current.dueAt ?? null,
      guid,
      status: input.status ?? current.status,
      title: input.title ?? current.title,
    };

    await this.recordRepository.update(
      { guid, kind: this.mapper.taskKind },
      this.mapper.mapTaskToOmniRecord(merged),
    );
    await this.legacyTaskRepository.update(
      { guid },
      {
        description: merged.description ?? null,
        dueAt: merged.dueAt ? new Date(merged.dueAt) : null,
        projectId:
          input.projectId !== undefined
            ? input.projectId ?? null
            : current.projectId,
        status: merged.status,
        title: merged.title,
      },
    );

    if (Object.prototype.hasOwnProperty.call(input, 'projectId')) {
      if (input.projectId) {
        await this.projectService.ensureProjectExists(input.projectId);
      }
      await this.syncContainsRelation(guid, input.projectId ?? null);
    }

    if (input.referenceIds) {
      await this.syncTaskRelations(
        guid,
        OmniRelationKind.References,
        input.referenceIds,
      );
    }

    if (input.relatedToIds) {
      await this.syncTaskRelations(
        guid,
        OmniRelationKind.RelatedTo,
        input.relatedToIds,
      );
    }

    return this.getById(guid);
  }

  async delete(guid: string) {
    await this.getTaskRecordOrFail(guid);
    await this.relationRepository.delete({ sourceRecordId: guid });
    await this.relationRepository.delete({ targetRecordId: guid });
    await this.recordRepository.delete({
      guid,
      kind: this.mapper.taskKind,
    });
    await this.legacyTaskRepository.delete({ guid });
    return { deleted: true };
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
