import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CrudGenFindManyOptions } from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interface';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import {
  OmniCollectionEntity,
  OmniExternalRefEntity,
  OmniExternalRefInternalType,
  OmniRecordEntity,
} from '@nestjs-yalc/omnikernel-module';
import { TaskExternalRef } from '@nestjs-yalc/task-system-module/src/task-external-ref.entity';
import { DeepPartial, FindOperator, In, Repository } from 'typeorm';
import {
  TaskAppOmniMapper,
  type TaskOmniPageQuery,
} from './task-app-omni.mapper';
import {
  TaskExternalRefCreateInput,
  TaskExternalRefType,
} from '../sync/task-external-ref.dto';

@Injectable()
export class TaskAppOmniExternalRefService {
  constructor(
    @InjectRepository(OmniRecordEntity)
    private readonly recordRepository: Repository<OmniRecordEntity>,
    @InjectRepository(OmniCollectionEntity)
    private readonly collectionRepository: Repository<OmniCollectionEntity>,
    @InjectRepository(OmniExternalRefEntity)
    private readonly externalRefRepository: Repository<OmniExternalRefEntity>,
    private readonly events: YalcEventService,
    private readonly mapper: TaskAppOmniMapper,
  ) {}

  supportsStructuredGraphqlFilters() {
    return false;
  }

  async list(
    query: TaskOmniPageQuery & { internalId?: string; internalType?: string },
  ) {
    const { skip, startRow, take } = this.mapper.parsePageQuery(query);
    const internalType = query.internalType
      ? this.mapper.mapTaskExternalRefInternalType(query.internalType)
      : undefined;

    if (query.internalId && internalType) {
      const refs = await this.externalRefRepository.find({
        where: {
          internalType,
          internalId: query.internalId,
          ...(query.provider ? { provider: query.provider } : {}),
        },
        order: {
          createdAt: 'ASC',
        },
      });
      const pagedRefs = refs.slice(skip, skip + take);

      return this.mapper.buildPage(
        pagedRefs.map((ref) => this.mapper.mapOmniExternalRefToTask(ref)),
        startRow,
        refs.length,
      );
    }

    const [refs, count] = await this.externalRefRepository.findAndCount({
      order: {
        createdAt: 'ASC',
      },
      skip,
      take,
      where: {
        ...(query.internalId ? { internalId: query.internalId } : {}),
        ...(internalType ? { internalType } : {}),
        ...(query.provider ? { provider: query.provider } : {}),
      },
    });

    return this.mapper.buildPage(
      refs.map((ref) => this.mapper.mapOmniExternalRefToTask(ref)),
      startRow,
      count,
    );
  }

  async getById(guid: string) {
    return this.getTaskExternalRefOrFail(guid);
  }

  async create(input: Partial<TaskExternalRefCreateInput>) {
    return this.createEntity(input);
  }

  async update(guid: string, input: Partial<TaskExternalRefCreateInput>) {
    return this.updateEntity({ guid }, input);
  }

  async delete(guid: string) {
    await this.deleteEntity({ guid });
    return { deleted: true };
  }

  async getEntity(
    where: Partial<TaskExternalRef> | Partial<TaskExternalRef>[] | string,
    _fields?: (keyof TaskExternalRef)[],
    _relations?: string[],
    _databaseName?: string,
    options?: {
      failOnNull?: boolean;
    },
  ): Promise<TaskExternalRefType | null | undefined> {
    const ref = await this.externalRefRepository.findOne({
      where: this.mapCrudGenWhereToOmniWhere(where),
    });

    if (!ref) {
      if (options?.failOnNull) {
        throw this.events.errorNotFound('sync.omni.external-ref.not-found', {
          data: {
            conditions: where,
          },
          response: {
            message: 'External reference not found',
          },
        });
      }

      return null;
    }

    return this.mapper.mapOmniExternalRefToTask(ref);
  }

  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<TaskExternalRef>,
    withCount?: false,
  ): Promise<TaskExternalRefType[]>;
  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<TaskExternalRef>,
    withCount: true,
  ): Promise<[TaskExternalRefType[], number]>;
  async getEntityListExtended(
    findOptions: CrudGenFindManyOptions<TaskExternalRef>,
    withCount = false,
  ): Promise<[TaskExternalRefType[], number] | TaskExternalRefType[]> {
    const skip = findOptions.skip ?? 0;
    const take = findOptions.take;
    const refs = await this.externalRefRepository.find({
      order: (findOptions.order as any) ?? { createdAt: 'ASC' },
      skip,
      take,
      where: this.mapCrudGenWhereToOmniWhere(
        findOptions.where as Partial<TaskExternalRef> | undefined,
      ),
    });

    if (!withCount) {
      return refs.map((ref) => this.mapper.mapOmniExternalRefToTask(ref));
    }

    const count = await this.externalRefRepository.count({
      where: this.mapCrudGenWhereToOmniWhere(
        findOptions.where as Partial<TaskExternalRef> | undefined,
      ),
    });

    return [
      refs.map((ref) => this.mapper.mapOmniExternalRefToTask(ref)),
      count,
    ];
  }

  async createEntity(
    input: DeepPartial<TaskExternalRef>,
    _findOptions?: CrudGenFindManyOptions<TaskExternalRef>,
    returnEntity = true,
  ): Promise<TaskExternalRefType | boolean> {
    this.validateExternalRefInput(input);
    await this.ensureInternalTargetExists(
      this.mapper.mapTaskExternalRefInternalType(input.internalType),
      input.internalId!,
    );

    const existing = await this.externalRefRepository.findOne({
      where: {
        provider: input.provider!,
        externalId: input.externalId!,
        account: input.account ?? null,
        container: input.container ?? null,
      },
    });

    const entity = this.externalRefRepository.create({
      ...this.mapper.mapExternalRefToOmniExternalRef(input),
      guid: existing?.guid ?? input.guid,
    });
    const storedRef = await this.externalRefRepository.save(entity);

    if (!returnEntity) {
      return true;
    }

    return this.getTaskExternalRefOrFail(storedRef.guid);
  }

  async updateEntity(
    conditions: Partial<TaskExternalRef>,
    input: DeepPartial<TaskExternalRef>,
    _findOptions?: CrudGenFindManyOptions<TaskExternalRef>,
    returnEntity = true,
  ): Promise<TaskExternalRefType | boolean> {
    const guid = this.requireGuid(conditions);
    const current = await this.getTaskExternalRefOrFail(guid);
    const merged: Partial<TaskExternalRefCreateInput> = {
      account:
        input.account !== undefined ? input.account : (current.account ?? null),
      container:
        input.container !== undefined
          ? input.container
          : (current.container ?? null),
      externalId: input.externalId ?? current.externalId,
      guid,
      internalId: input.internalId ?? current.internalId,
      internalType: input.internalType ?? current.internalType,
      provider: input.provider ?? current.provider,
    };

    await this.ensureInternalTargetExists(
      this.mapper.mapTaskExternalRefInternalType(merged.internalType),
      merged.internalId!,
    );

    await this.externalRefRepository.update(
      { guid },
      this.mapper.mapExternalRefToOmniExternalRef(merged),
    );

    if (!returnEntity) {
      return true;
    }

    return this.getTaskExternalRefOrFail(guid);
  }

  async deleteEntity(conditions: Partial<TaskExternalRef>): Promise<boolean> {
    const guid = this.requireGuid(conditions);
    await this.getExternalRefOrFail(guid);
    await this.externalRefRepository.delete({ guid });
    return true;
  }

  private validateExternalRefInput(input: Partial<TaskExternalRefCreateInput>) {
    if (
      !input.guid ||
      !input.internalId ||
      !input.provider ||
      !input.externalId
    ) {
      throw this.events.errorBadRequest('sync.omni.external-ref.invalid', {
        data: {
          externalId: input.externalId ?? null,
          guid: input.guid ?? null,
          internalId: input.internalId ?? null,
          provider: input.provider ?? null,
        },
        response: {
          message:
            'External ref guid, internalId, provider, and externalId are required',
        },
      });
    }
  }

  private async getExternalRefOrFail(guid: string) {
    const ref = await this.externalRefRepository.findOne({
      where: {
        guid,
      },
    });

    if (!ref) {
      throw this.events.errorNotFound('sync.omni.external-ref.not-found', {
        data: {
          externalRefId: guid,
        },
        response: {
          message: 'External reference not found',
        },
      });
    }

    return ref;
  }

  private async getTaskExternalRefOrFail(guid: string) {
    const ref = await this.getExternalRefOrFail(guid);
    return this.mapper.mapOmniExternalRefToTask(ref);
  }

  private mapCrudGenWhereToOmniWhere(
    where?: Partial<TaskExternalRef> | Partial<TaskExternalRef>[] | string,
  ) {
    if (typeof where === 'string') {
      return {
        guid: where,
      };
    }

    if (Array.isArray(where)) {
      const [firstCondition] = where;
      return this.mapCrudGenWhereToOmniWhere(firstCondition);
    }

    const rawWhere =
      where && typeof where === 'object'
        ? this.mapper.extractCrudGenFilterMap(where)
        : where;

    if (!rawWhere) {
      return {};
    }

    const omniWhere: Record<string, unknown> = {};
    for (const [key, rawValue] of Object.entries(rawWhere)) {
      if (key === 'filters' || rawValue === undefined) {
        continue;
      }

      if (key === 'internalType') {
        omniWhere[key] = this.mapInternalTypeFilter(rawValue);
        continue;
      }

      omniWhere[key] = rawValue;
    }

    return omniWhere;
  }

  private mapInternalTypeFilter(value: unknown) {
    if (value instanceof FindOperator && Array.isArray((value as any).value)) {
      return In(
        ((value as any).value as unknown[]).map((item) =>
          this.mapper.mapTaskExternalRefInternalType(
            item as string | undefined,
          ),
        ),
      );
    }

    if (typeof value === 'string') {
      return this.mapper.mapTaskExternalRefInternalType(value);
    }

    return value;
  }

  private requireGuid(conditions: Partial<TaskExternalRef>) {
    if (!conditions.guid) {
      throw this.events.errorBadRequest(
        'sync.omni.external-ref.guid.required',
        {
          data: {
            conditions,
          },
          response: {
            message: 'TaskExternalRefCondition.guid is required',
          },
        },
      );
    }

    return conditions.guid;
  }

  private async ensureInternalTargetExists(
    internalType: OmniExternalRefInternalType,
    internalId: string,
  ) {
    if (internalType === OmniExternalRefInternalType.Collection) {
      const collection = await this.collectionRepository.findOne({
        where: {
          guid: internalId,
        },
      });

      if (collection) {
        return;
      }
    }

    if (internalType !== OmniExternalRefInternalType.Collection) {
      const record = await this.recordRepository.findOne({
        where: {
          guid: internalId,
        },
      });

      if (record) {
        return;
      }
    }

    throw this.events.errorNotFound('sync.omni.external-ref.target.not-found', {
      data: {
        internalId,
        internalType,
      },
      response: {
        message: 'Referenced internal resource was not found',
      },
    });
  }
}
