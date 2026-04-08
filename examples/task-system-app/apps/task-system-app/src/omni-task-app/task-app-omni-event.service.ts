import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import {
  OmniRecordEntity,
  OmniRelationEntity,
  OmniRelationKind,
  OmniRelationStatus,
} from '@nestjs-yalc/omnikernel-module';
import { randomUUID } from 'node:crypto';
import { In, Repository } from 'typeorm';
import {
  TaskAppOmniMapper,
  type TaskOmniPageQuery,
} from './task-app-omni.mapper';
import { TaskEventCreateInput, TaskEventType } from './task-app.types';
import { TaskAppOmniProjectService } from './task-app-omni-project.service';

@Injectable()
export class TaskAppOmniEventService {
  constructor(
    @InjectRepository(OmniRecordEntity)
    private readonly recordRepository: Repository<OmniRecordEntity>,
    @InjectRepository(OmniRelationEntity)
    private readonly relationRepository: Repository<OmniRelationEntity>,
    private readonly events: YalcEventService,
    private readonly mapper: TaskAppOmniMapper,
    private readonly projectService: TaskAppOmniProjectService,
  ) {}

  async list(query: TaskOmniPageQuery = {}) {
    const pagination = this.mapper.parsePageQuery(query);

    if (query.projectId) {
      await this.projectService.ensureProjectExists(query.projectId);
      const [events, count] = await this.getCollectionMembersByKind(
        query.projectId,
        this.mapper.eventKind,
        pagination.skip,
        pagination.take,
      );

      return this.mapper.buildPage(
        events.map((event) =>
          this.mapper.mapOmniRecordToEvent(event, query.projectId),
        ),
        pagination.startRow,
        count,
      );
    }

    const [records, count] = await this.recordRepository.findAndCount({
      order: { createdAt: 'ASC' },
      skip: pagination.skip,
      take: pagination.take,
      where: { kind: this.mapper.eventKind },
    });

    const projectIds = await this.getProjectIds(records.map((r) => r.guid));

    return this.mapper.buildPage(
      records.map((record) =>
        this.mapper.mapOmniRecordToEvent(
          record,
          projectIds.get(record.guid) ?? null,
        ),
      ),
      pagination.startRow,
      count,
    );
  }

  async getById(guid: string): Promise<TaskEventType> {
    const record = await this.getEventRecordOrFail(guid);
    const projectId = await this.getProjectIdForEvent(guid);
    return this.mapper.mapOmniRecordToEvent(record, projectId);
  }

  async create(input: Partial<TaskEventCreateInput>): Promise<TaskEventType> {
    if (!input.guid || !input.title || !input.startAt) {
      throw this.events.errorBadRequest('events.omni.create.invalid', {
        response: { message: 'Event guid, title, and startAt are required' },
      });
    }

    if (input.projectId) {
      await this.projectService.ensureProjectExists(input.projectId);
    }

    const record = this.recordRepository.create(
      this.mapper.mapEventToOmniRecord(input),
    );
    await this.recordRepository.save(record);
    await this.syncContainsRelation(record.guid, input.projectId ?? null);
    return this.getById(record.guid);
  }

  async update(
    guid: string,
    input: Partial<TaskEventCreateInput>,
  ): Promise<TaskEventType> {
    const current = await this.getById(guid);
    const merged: Partial<TaskEventCreateInput> = {
      guid,
      title: input.title ?? current.title,
      description:
        input.description !== undefined
          ? input.description
          : current.description ?? null,
      status: input.status ?? current.status,
      startAt: input.startAt ?? current.startAt,
      endAt: input.endAt !== undefined ? input.endAt : current.endAt ?? null,
      allDay: input.allDay ?? current.allDay,
      location:
        input.location !== undefined
          ? input.location
          : current.location ?? null,
    };

    await this.recordRepository.update(
      { guid, kind: this.mapper.eventKind },
      this.mapper.mapEventToOmniRecord(merged),
    );

    if (Object.prototype.hasOwnProperty.call(input, 'projectId')) {
      if (input.projectId) {
        await this.projectService.ensureProjectExists(input.projectId);
      }
      await this.syncContainsRelation(guid, input.projectId ?? null);
    }

    return this.getById(guid);
  }

  async delete(guid: string) {
    await this.getEventRecordOrFail(guid);
    await this.relationRepository.delete({ sourceRecordId: guid });
    await this.relationRepository.delete({ targetRecordId: guid });
    await this.recordRepository.delete({ guid, kind: this.mapper.eventKind });
    return { deleted: true };
  }

  private async getEventRecordOrFail(guid: string) {
    const record = await this.recordRepository.findOne({
      where: { guid, kind: this.mapper.eventKind },
    });

    if (!record) {
      throw this.events.errorNotFound('events.omni.not-found', {
        response: { message: 'Event not found' },
      });
    }

    return record;
  }

  private async getCollectionMembersByKind(
    collectionId: string,
    recordKind: string,
    skip: number,
    take: number,
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
    const relations = await baseQuery
      .orderBy('relation.createdAt', 'ASC')
      .skip(skip)
      .take(take)
      .getMany();

    return [
      relations
        .map((relation) => relation.targetRecord)
        .filter((record): record is OmniRecordEntity => !!record),
      count,
    ];
  }

  private async getProjectIds(eventIds: string[]) {
    const projectIds = new Map<string, string | null>();
    if (!eventIds.length) return projectIds;

    const relations = await this.relationRepository.find({
      where: {
        kind: OmniRelationKind.Contains,
        status: OmniRelationStatus.Active,
        targetRecordId: In(eventIds),
      },
      order: { createdAt: 'ASC' },
    });

    for (const relation of relations) {
      if (!projectIds.has(relation.targetRecordId)) {
        projectIds.set(relation.targetRecordId, relation.sourceRecordId);
      }
    }

    return projectIds;
  }

  private async getProjectIdForEvent(eventId: string) {
    const relation = await this.relationRepository.findOne({
      where: {
        kind: OmniRelationKind.Contains,
        status: OmniRelationStatus.Active,
        targetRecordId: eventId,
      },
      order: { createdAt: 'ASC' },
    });

    return relation?.sourceRecordId ?? null;
  }

  private async syncContainsRelation(
    eventId: string,
    projectId: string | null,
  ) {
    await this.relationRepository.delete({
      kind: OmniRelationKind.Contains,
      targetRecordId: eventId,
    });

    if (!projectId) return;

    await this.relationRepository.save(
      this.relationRepository.create({
        guid: randomUUID(),
        kind: OmniRelationKind.Contains,
        sourceRecordId: projectId,
        status: OmniRelationStatus.Active,
        targetRecordId: eventId,
      }),
    );
  }
}
