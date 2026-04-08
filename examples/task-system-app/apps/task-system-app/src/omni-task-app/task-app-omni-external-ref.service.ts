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
import { TaskExternalRef } from '@nestjs-yalc/task-system-module';
import { Repository } from 'typeorm';
import {
  TaskAppOmniMapper,
  type TaskOmniPageQuery,
} from './task-app-omni.mapper';

@Injectable()
export class TaskAppOmniExternalRefService {
  constructor(
    @InjectRepository(OmniRecordEntity)
    private readonly recordRepository: Repository<OmniRecordEntity>,
    @InjectRepository(OmniCollectionEntity)
    private readonly collectionRepository: Repository<OmniCollectionEntity>,
    @InjectRepository(TaskExternalRef)
    private readonly legacyExternalRefRepository: Repository<TaskExternalRef>,
    private readonly externalRefService: OmniExternalRefService,
    private readonly events: YalcEventService,
    private readonly mapper: TaskAppOmniMapper,
  ) {}

  async list(
    query: TaskOmniPageQuery & { internalId?: string; internalType?: string },
  ) {
    const { skip, startRow, take } = this.mapper.parsePageQuery(query);
    const internalType = query.internalType
      ? this.mapper.mapTaskExternalRefInternalType(query.internalType)
      : undefined;

    if (query.internalId && internalType) {
      const refs = await this.externalRefService.findForInternalRecord(
        internalType,
        query.internalId,
        query.provider,
      );
      const pagedRefs = refs.slice(skip, skip + take);

      return this.mapper.buildPage(
        pagedRefs.map((ref) => this.mapper.mapOmniExternalRefToTask(ref)),
        startRow,
        refs.length,
      );
    }

    const [refs, count] = await this.externalRefService
      .getRepository()
      .findAndCount({
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
    const ref = await this.getExternalRefOrFail(guid);
    return this.mapper.mapOmniExternalRefToTask(ref);
  }

  async create(input: Partial<TaskExternalRef>) {
    this.validateExternalRefInput(input);
    await this.ensureInternalTargetExists(
      this.mapper.mapTaskExternalRefInternalType(input.internalType),
      input.internalId!,
    );

    const storedRef = await this.externalRefService.upsertExternalRef(
      this.mapper.mapExternalRefToOmniExternalRef(input) as Parameters<
        OmniExternalRefService['upsertExternalRef']
      >[0],
    );
    await this.legacyExternalRefRepository.save(
      this.legacyExternalRefRepository.create({
        account: input.account ?? null,
        container: input.container ?? null,
        externalId: input.externalId,
        guid: storedRef.guid,
        internalId: input.internalId,
        internalType: input.internalType ?? 'task',
        provider: input.provider,
      }),
    );

    return this.getById(storedRef.guid);
  }

  async update(guid: string, input: Partial<TaskExternalRef>) {
    const current = await this.getById(guid);
    const merged: Partial<TaskExternalRef> = {
      account:
        input.account !== undefined ? input.account : current.account ?? null,
      container:
        input.container !== undefined
          ? input.container
          : current.container ?? null,
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

    await this.externalRefService.updateEntity(
      { guid },
      this.mapper.mapExternalRefToOmniExternalRef(merged),
    );
    await this.legacyExternalRefRepository.update(
      { guid },
      {
        account: merged.account ?? null,
        container: merged.container ?? null,
        externalId: merged.externalId,
        internalId: merged.internalId,
        internalType: merged.internalType,
        provider: merged.provider,
      },
    );

    return this.getById(guid);
  }

  async delete(guid: string) {
    await this.getExternalRefOrFail(guid);
    await this.externalRefService.deleteEntity({ guid });
    await this.legacyExternalRefRepository.delete({ guid });
    return { deleted: true };
  }

  private validateExternalRefInput(input: Partial<TaskExternalRef>) {
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
    const ref = await this.externalRefService.getRepository().findOne({
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
