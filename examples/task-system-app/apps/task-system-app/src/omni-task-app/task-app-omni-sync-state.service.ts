import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import { OmniRecordEntity } from '@nestjs-yalc/omnikernel-module';
import { Repository } from 'typeorm';
import {
  TaskAppOmniMapper,
  type TaskOmniPageQuery,
} from './task-app-omni.mapper';
import { TaskSyncStateCreateInput, TaskSyncStateType } from './task-app.types';
import { TaskAppOmniExternalRefService } from './task-app-omni-external-ref.service';

@Injectable()
export class TaskAppOmniSyncStateService {
  constructor(
    @InjectRepository(OmniRecordEntity)
    private readonly recordRepository: Repository<OmniRecordEntity>,
    private readonly events: YalcEventService,
    private readonly mapper: TaskAppOmniMapper,
    private readonly externalRefService: TaskAppOmniExternalRefService,
  ) {}

  async list(query: TaskOmniPageQuery = {}) {
    const { skip, startRow, take } = this.mapper.parsePageQuery(query);
    const [records, count] = await this.recordRepository.findAndCount({
      order: { createdAt: 'ASC' },
      skip,
      take,
      where: { kind: this.mapper.syncStateKind },
    });

    return this.mapper.buildPage(
      records.map((record) => this.mapper.mapOmniRecordToSyncState(record)),
      startRow,
      count,
    );
  }

  async getById(guid: string): Promise<TaskSyncStateType> {
    const record = await this.getSyncStateRecordOrFail(guid);
    return this.mapper.mapOmniRecordToSyncState(record);
  }

  async create(
    input: Partial<TaskSyncStateCreateInput>,
  ): Promise<TaskSyncStateType> {
    if (!input.guid || !input.externalRefId) {
      throw this.events.errorBadRequest('sync-state.omni.create.invalid', {
        response: { message: 'Sync state guid and externalRefId are required' },
      });
    }

    await this.externalRefService.getById(input.externalRefId);

    const entity = this.recordRepository.create(
      this.mapper.mapSyncStateToOmniRecord(input),
    );
    await this.recordRepository.save(entity);
    return this.getById(entity.guid);
  }

  async update(
    guid: string,
    input: Partial<TaskSyncStateCreateInput>,
  ): Promise<TaskSyncStateType> {
    const current = await this.getById(guid);
    const merged: Partial<TaskSyncStateCreateInput> = {
      guid,
      externalRefId: input.externalRefId ?? current.externalRefId,
      status: input.status ?? current.status,
      lastSyncedAt:
        input.lastSyncedAt !== undefined
          ? input.lastSyncedAt
          : current.lastSyncedAt ?? null,
      lastDirection:
        input.lastDirection !== undefined
          ? input.lastDirection
          : current.lastDirection ?? null,
      remoteVersion:
        input.remoteVersion !== undefined
          ? input.remoteVersion
          : current.remoteVersion ?? null,
      localVersionHash:
        input.localVersionHash !== undefined
          ? input.localVersionHash
          : current.localVersionHash ?? null,
      lastError:
        input.lastError !== undefined
          ? input.lastError
          : current.lastError ?? null,
    };

    await this.externalRefService.getById(merged.externalRefId!);

    await this.recordRepository.update(
      { guid, kind: this.mapper.syncStateKind },
      this.mapper.mapSyncStateToOmniRecord(merged),
    );

    return this.getById(guid);
  }

  async delete(guid: string) {
    await this.getSyncStateRecordOrFail(guid);
    await this.recordRepository.delete({
      guid,
      kind: this.mapper.syncStateKind,
    });
    return { deleted: true };
  }

  private async getSyncStateRecordOrFail(guid: string) {
    const record = await this.recordRepository.findOne({
      where: { guid, kind: this.mapper.syncStateKind },
    });

    if (!record) {
      throw this.events.errorNotFound('sync-state.omni.not-found', {
        response: { message: 'Sync state not found' },
      });
    }

    return record;
  }
}
