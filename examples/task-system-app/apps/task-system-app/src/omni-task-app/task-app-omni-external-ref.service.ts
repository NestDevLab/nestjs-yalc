import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import {
  OmniCollectionEntity,
  OmniExternalRefEntity,
  OmniExternalRefInternalType,
  OmniExternalRefService,
  OmniRecordEntity,
} from '@nestjs-yalc/omnikernel-module';
import type { CrudGenFindManyOptions } from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interface';
import { GenericTypeORMRepository } from '@nestjs-yalc/crud-gen/typeorm/generic.repository';
import type { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { TaskAppOmniMapper } from './task-app-omni.mapper';
import {
  TaskExternalRefCreateInput,
  TaskExternalRefType,
} from '../sync/task-external-ref.dto';

@Injectable()
export class TaskAppOmniExternalRefService extends OmniExternalRefService {
  constructor(
    @InjectRepository(OmniExternalRefEntity)
    externalRefRepository: GenericTypeORMRepository<OmniExternalRefEntity>,
    @InjectRepository(OmniRecordEntity)
    private readonly recordRepository: Repository<OmniRecordEntity>,
    @InjectRepository(OmniCollectionEntity)
    private readonly collectionRepository: Repository<OmniCollectionEntity>,
    private readonly events: YalcEventService,
    private readonly mapper: TaskAppOmniMapper,
  ) {
    super(externalRefRepository);
  }

  override async createEntity(
    input: DeepPartial<OmniExternalRefEntity>,
    findOptions?: CrudGenFindManyOptions<OmniExternalRefEntity>,
    returnEntity?: true,
  ): Promise<OmniExternalRefEntity>;
  override async createEntity(
    input: DeepPartial<OmniExternalRefEntity>,
    findOptions?: CrudGenFindManyOptions<OmniExternalRefEntity>,
    returnEntity?: boolean,
  ): Promise<OmniExternalRefEntity | boolean>;
  override async createEntity(
    input: DeepPartial<OmniExternalRefEntity>,
    findOptions?: CrudGenFindManyOptions<OmniExternalRefEntity>,
    returnEntity = true,
  ): Promise<OmniExternalRefEntity | boolean> {
    this.validateExternalRefInput(input);
    await this.ensureInternalTargetExists(
      input.internalType as OmniExternalRefInternalType,
      input.internalId!,
    );

    const existing = await this.findByExternalIdentity({
      provider: input.provider!,
      externalId: input.externalId!,
      account: input.account ?? null,
      container: input.container ?? null,
    });

    if (existing) {
      return this.updateEntity(
        { guid: existing.guid },
        {
          ...input,
          guid: existing.guid,
        },
        findOptions,
        returnEntity,
      );
    }

    return super.createEntity(input, findOptions, returnEntity);
  }

  override async updateEntity(
    conditions: FindOptionsWhere<OmniExternalRefEntity>,
    input: DeepPartial<OmniExternalRefEntity>,
    findOptions?: CrudGenFindManyOptions<OmniExternalRefEntity>,
    returnEntity?: true,
  ): Promise<OmniExternalRefEntity>;
  override async updateEntity(
    conditions: FindOptionsWhere<OmniExternalRefEntity>,
    input: DeepPartial<OmniExternalRefEntity>,
    findOptions?: CrudGenFindManyOptions<OmniExternalRefEntity>,
    returnEntity?: boolean,
  ): Promise<OmniExternalRefEntity | boolean>;
  override async updateEntity(
    conditions: FindOptionsWhere<OmniExternalRefEntity>,
    input: DeepPartial<OmniExternalRefEntity>,
    findOptions?: CrudGenFindManyOptions<OmniExternalRefEntity>,
    returnEntity = true,
  ): Promise<OmniExternalRefEntity | boolean> {
    const current = await this.getRepository().findOne({ where: conditions });
    if (!current) {
      throw this.events.errorNotFound('sync.omni.external-ref.not-found', {
        data: { conditions },
        response: { message: 'External reference not found' },
      });
    }

    const merged = {
      ...current,
      ...input,
      account: input.account !== undefined ? input.account : current.account,
      container:
        input.container !== undefined ? input.container : current.container,
      externalId: input.externalId ?? current.externalId,
      internalId: input.internalId ?? current.internalId,
      internalType: input.internalType ?? current.internalType,
      provider: input.provider ?? current.provider,
    };

    this.validateExternalRefInput(merged);
    await this.ensureInternalTargetExists(
      merged.internalType as OmniExternalRefInternalType,
      merged.internalId!,
    );

    return super.updateEntity(conditions, merged, findOptions, returnEntity);
  }

  async getById(guid: string): Promise<TaskExternalRefType> {
    const ref = await this.getRepository().findOne({ where: { guid } });
    if (!ref) {
      throw this.events.errorNotFound('sync.omni.external-ref.not-found', {
        data: { externalRefId: guid },
        response: { message: 'External reference not found' },
      });
    }

    return this.mapper.mapOmniExternalRefToTask(ref);
  }

  private validateExternalRefInput(input: DeepPartial<OmniExternalRefEntity>) {
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

  private async ensureInternalTargetExists(
    internalType: OmniExternalRefInternalType,
    internalId: string,
  ) {
    if (internalType === OmniExternalRefInternalType.Collection) {
      const collection = await this.collectionRepository.findOne({
        where: { guid: internalId },
      });
      if (collection) return;
    }

    if (internalType !== OmniExternalRefInternalType.Collection) {
      const record = await this.recordRepository.findOne({
        where: { guid: internalId },
      });
      if (record) return;
    }

    throw this.events.errorNotFound('sync.omni.external-ref.target.not-found', {
      data: { internalId, internalType },
      response: { message: 'Referenced internal resource was not found' },
    });
  }
}
