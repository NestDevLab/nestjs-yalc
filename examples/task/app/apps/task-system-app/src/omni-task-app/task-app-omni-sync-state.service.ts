import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CrudGenFindManyOptions } from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interface';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import { OmniRecordEntity } from '@nestjs-yalc/omnikernel-module';
import { TaskSyncState } from '@nestjs-yalc/task-system-module/src/task-sync-state.entity';
import { DeepPartial, FindOperator, In, Repository } from 'typeorm';
import {
  TaskAppOmniMapper,
  type TaskOmniPageQuery,
} from './task-app-omni.mapper';
import { TaskAppOmniExternalRefService } from './task-app-omni-external-ref.service';
import {
  TaskSyncStateCreateInput,
  TaskSyncStateType,
} from '../sync/task-sync-state.dto';

@Injectable()
export class TaskAppOmniSyncStateService {
  constructor(
    @InjectRepository(OmniRecordEntity)
    private readonly recordRepository: Repository<OmniRecordEntity>,
    private readonly events: YalcEventService,
    private readonly mapper: TaskAppOmniMapper,
    private readonly externalRefService: TaskAppOmniExternalRefService,
  ) {}

  supportsStructuredGraphqlFilters() {
    return false;
  }

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
    return this.getTaskSyncStateOrFail(guid);
  }

  async create(
    input: Partial<TaskSyncStateCreateInput>,
  ): Promise<TaskSyncStateType> {
    return this.createEntity(input) as Promise<TaskSyncStateType>;
  }

  async update(
    guid: string,
    input: Partial<TaskSyncStateCreateInput>,
  ): Promise<TaskSyncStateType> {
    return this.updateEntity({ guid }, input) as Promise<TaskSyncStateType>;
  }

  async delete(guid: string) {
    await this.deleteEntity({ guid });
    return { deleted: true };
  }

  async getEntity(
    where: Partial<TaskSyncState> | Partial<TaskSyncState>[] | string,
    _fields?: (keyof TaskSyncState)[],
    _relations?: string[],
    _databaseName?: string,
    options?: {
      failOnNull?: boolean;
    },
  ): Promise<TaskSyncStateType | null | undefined> {
    const record = await this.recordRepository.findOne({
      where: this.mapCrudGenWhereToOmniWhere(where),
    });

    if (!record) {
      if (options?.failOnNull) {
        throw this.events.errorNotFound('sync-state.omni.not-found', {
          data: { conditions: where },
          response: { message: 'Sync state not found' },
        });
      }

      return null;
    }

    return this.mapper.mapOmniRecordToSyncState(record);
  }

  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<TaskSyncState>,
    withCount?: false,
  ): Promise<TaskSyncStateType[]>;
  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<TaskSyncState>,
    withCount: true,
  ): Promise<[TaskSyncStateType[], number]>;
  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<TaskSyncState>,
    withCount = false,
  ): Promise<[TaskSyncStateType[], number] | TaskSyncStateType[]> {
    const skip = findOptions.skip ?? 0;
    const take = findOptions.take;
    const where = this.mapCrudGenWhereToOmniWhere(
      findOptions.where as Partial<TaskSyncState> | undefined,
    );
    const records = await this.recordRepository.find({
      order: (findOptions.order as any) ?? { createdAt: 'ASC' },
      skip,
      take,
      where,
    });

    if (!withCount) {
      return records.map((record) =>
        this.mapper.mapOmniRecordToSyncState(record),
      );
    }

    const count = await this.recordRepository.count({ where });

    return [
      records.map((record) => this.mapper.mapOmniRecordToSyncState(record)),
      count,
    ];
  }

  async createEntity(
    input: DeepPartial<TaskSyncState>,
    _findOptions?: CrudGenFindManyOptions<TaskSyncState>,
    returnEntity = true,
  ): Promise<TaskSyncStateType | boolean> {
    if (!input.guid || !input.externalRefId) {
      throw this.events.errorBadRequest('sync-state.omni.create.invalid', {
        response: { message: 'Sync state guid and externalRefId are required' },
      });
    }

    await this.externalRefService.getById(input.externalRefId);

    const createInput: Partial<TaskSyncStateCreateInput> = {
      externalRefId: input.externalRefId,
      guid: input.guid,
      lastDirection: input.lastDirection,
      lastError: input.lastError,
      lastSyncedAt: input.lastSyncedAt as Date | null | undefined,
      localVersionHash: input.localVersionHash,
      remoteVersion: input.remoteVersion,
      status: input.status,
    };

    const entity = this.recordRepository.create(
      this.mapper.mapSyncStateToOmniRecord(createInput),
    );
    await this.recordRepository.save(entity);

    if (!returnEntity) {
      return true;
    }

    return this.getTaskSyncStateOrFail(entity.guid);
  }

  async updateEntity(
    conditions: Partial<TaskSyncState>,
    input: DeepPartial<TaskSyncState>,
    _findOptions?: CrudGenFindManyOptions<TaskSyncState>,
    returnEntity = true,
  ): Promise<TaskSyncStateType | boolean> {
    const guid = this.requireGuid(conditions);
    const current = await this.getTaskSyncStateOrFail(guid);
    const merged: Partial<TaskSyncStateCreateInput> = {
      guid,
      externalRefId: input.externalRefId ?? current.externalRefId,
      status: input.status ?? current.status,
      lastSyncedAt:
        input.lastSyncedAt !== undefined
          ? (input.lastSyncedAt as Date | null)
          : (current.lastSyncedAt ?? null),
      lastDirection:
        input.lastDirection !== undefined
          ? input.lastDirection
          : (current.lastDirection ?? null),
      remoteVersion:
        input.remoteVersion !== undefined
          ? input.remoteVersion
          : (current.remoteVersion ?? null),
      localVersionHash:
        input.localVersionHash !== undefined
          ? input.localVersionHash
          : (current.localVersionHash ?? null),
      lastError:
        input.lastError !== undefined
          ? input.lastError
          : (current.lastError ?? null),
    };

    await this.externalRefService.getById(merged.externalRefId!);

    await this.recordRepository.update(
      { guid, kind: this.mapper.syncStateKind },
      this.mapper.mapSyncStateToOmniRecord(merged),
    );

    if (!returnEntity) {
      return true;
    }

    return this.getTaskSyncStateOrFail(guid);
  }

  async deleteEntity(conditions: Partial<TaskSyncState>): Promise<boolean> {
    const guid = this.requireGuid(conditions);
    await this.getSyncStateRecordOrFail(guid);
    await this.recordRepository.delete({
      guid,
      kind: this.mapper.syncStateKind,
    });
    return true;
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

  private async getTaskSyncStateOrFail(guid: string) {
    const record = await this.getSyncStateRecordOrFail(guid);
    return this.mapper.mapOmniRecordToSyncState(record);
  }

  private requireGuid(conditions: Partial<TaskSyncState>) {
    if (!conditions.guid) {
      throw this.events.errorBadRequest('sync-state.omni.conditions.invalid', {
        response: { message: 'Sync state guid is required' },
      });
    }

    return conditions.guid;
  }

  private mapCrudGenWhereToOmniWhere(
    where?: Partial<TaskSyncState> | Partial<TaskSyncState>[] | string,
  ) {
    const baseWhere = { kind: this.mapper.syncStateKind };

    if (!where) {
      return baseWhere;
    }

    if (typeof where === 'string') {
      return {
        ...baseWhere,
        guid: where,
      };
    }

    if (Array.isArray(where)) {
      return where.map((item) => this.mapCrudGenWhereToOmniWhere(item));
    }

    const guid = where.guid as string | FindOperator<string> | undefined;

    return {
      ...baseWhere,
      ...(guid instanceof FindOperator
        ? this.mapGuidFindOperator(guid)
        : guid
          ? { guid }
          : {}),
      ...(where.status ? { status: where.status } : {}),
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
}
