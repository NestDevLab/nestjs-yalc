import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import { In, QueryFailedError, Repository } from 'typeorm';
import { ChangeRequestEntity, ChangeRequestItemEntity } from './entities.js';
import { ChangeRequestAdapterRegistry } from './registry.js';
import {
  CHANGE_REQUEST_ITEM_REPOSITORY,
  CHANGE_REQUEST_REPOSITORY,
} from './tokens.js';
import type {
  ChangeRequestActor,
  ChangeRequestItemInput,
  ChangeRequestItemResult,
  ChangeRequestListFilter,
  CreateChangeRequest,
} from './types.js';

const canonicalStringify = (value: unknown): string =>
  JSON.stringify(value ?? null, (_key, current: unknown) => {
    if (
      current === null ||
      typeof current !== 'object' ||
      Array.isArray(current)
    )
      return current;
    return Object.fromEntries(
      Object.keys(current)
        .sort()
        .map((key) => [key, (current as Record<string, unknown>)[key]]),
    );
  });
const hash = (value: unknown): string =>
  createHash('sha256').update(canonicalStringify(value)).digest('hex');

const isOpenFieldConflict = (error: unknown): boolean => {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as {
    code?: string;
    constraint?: string;
    message?: string;
  };
  if (driverError.code === '23505')
    return driverError.constraint === 'uq_change_request_open_field';
  return Boolean(
    driverError.code?.startsWith('SQLITE_CONSTRAINT') &&
    driverError.message?.includes(
      'UNIQUE constraint failed: change_request_items.',
    ),
  );
};
const normalize = (
  item: ChangeRequestItemInput,
): ChangeRequestItemInput & { variant: string } => ({
  ...item,
  variant: item.variant ?? '',
});

@Injectable()
export class ChangeRequestService {
  constructor(
    @Inject(CHANGE_REQUEST_REPOSITORY)
    private readonly requests: Repository<ChangeRequestEntity>,
    @Inject(CHANGE_REQUEST_ITEM_REPOSITORY)
    private readonly items: Repository<ChangeRequestItemEntity>,
    @Inject(ChangeRequestAdapterRegistry)
    private readonly adapters: ChangeRequestAdapterRegistry,
    @Inject(YalcEventService)
    private readonly events: YalcEventService,
  ) {}

  async create(input: CreateChangeRequest): Promise<ChangeRequestEntity> {
    const adapter = this.adapters.get(input.entityType, input.target);
    const changes = input.items.map(normalize);
    if (
      !changes.length ||
      new Set(
        changes.map((item) => JSON.stringify([item.fieldKey, item.variant])),
      ).size !== changes.length
    ) {
      throw this.events.errorBadRequest('change-request.invalid-items', {
        response: { message: 'Items must be nonempty and unique' },
      });
    }
    await adapter.validate(input.entityId, changes);
    const live = await adapter.read(input.entityId, changes);
    const base = changes.map((item) => this.liveValue(live, item));
    const request = await this.requests.manager
      .transaction(async (manager) => {
        for (const item of changes) {
          const existing = await manager.findOne(ChangeRequestItemEntity, {
            where: {
              entityType: input.entityType,
              target: input.target,
              entityId: input.entityId,
              fieldKey: item.fieldKey,
              variant: item.variant,
            },
          });
          if (existing) {
            await manager.remove(existing);
            await this.dropEmpty(existing.changeRequestId, manager);
          }
        }
        const created = await manager.save(
          ChangeRequestEntity,
          manager.create(ChangeRequestEntity, {
            id: randomUUID(),
            entityType: input.entityType,
            target: input.target,
            entityId: input.entityId,
            title: input.title ?? null,
            proposerKind: input.proposer.kind,
            proposerId: input.proposer.id ?? null,
            proposerLabel: input.proposer.label,
            source: input.source ?? null,
            note: input.note ?? null,
          }),
        );
        await manager.save(
          ChangeRequestItemEntity,
          changes.map((item, index) =>
            manager.create(ChangeRequestItemEntity, {
              id: randomUUID(),
              changeRequestId: created.id,
              entityType: input.entityType,
              target: input.target,
              entityId: input.entityId,
              fieldKey: item.fieldKey,
              variant: item.variant,
              baseValue: base[index] ?? null,
              baseHash: hash(base[index]),
              proposedValue: item.proposedValue ?? null,
              state: 'proposed',
              publishError: null,
            }),
          ),
        );
        return created;
      })
      .catch((error: unknown) => {
        if (isOpenFieldConflict(error)) {
          throw this.events.errorConflict(
            'change-request.open-field-conflict',
            {
              response: {
                message: 'An open change already exists for this field',
              },
            },
          );
        }
        throw error;
      });
    await this.emit('created', request.id, changes.length);
    return this.load(request.id);
  }

  async list(filter: ChangeRequestListFilter = {}): Promise<{
    requests: ChangeRequestEntity[];
    total: number;
    openItemCount: number;
  }> {
    const qb = this.requests.createQueryBuilder('request');
    if (filter.entityType)
      qb.andWhere('request.entityType = :entityType', {
        entityType: filter.entityType,
      });
    if (filter.target)
      qb.andWhere('request.target = :target', { target: filter.target });
    if (filter.entityId)
      qb.andWhere('request.entityId = :entityId', {
        entityId: filter.entityId,
      });
    if (filter.state)
      qb.innerJoin('request.items', 'matched', 'matched.state = :state', {
        state: filter.state,
      });
    const total = await qb.getCount();
    const matchingIds = (
      await qb
        .clone()
        .select('request.id', 'id')
        .distinct(true)
        .getRawMany<{ id: string }>()
    ).map((row) => row.id);
    const ids = (
      await qb
        .clone()
        .select('request.id', 'id')
        .addSelect('request.createdAt', 'createdAt')
        .distinct(true)
        .orderBy('request.createdAt', 'DESC')
        .addOrderBy('request.id', 'DESC')
        .offset(filter.offset ?? 0)
        .limit(filter.limit ?? 50)
        .getRawMany<{ id: string }>()
    ).map((row) => row.id);
    const requests = ids.length
      ? await this.requests.find({
          where: { id: In(ids) },
          relations: { items: true },
        })
      : [];
    const openItemCount = matchingIds.length
      ? await this.items.count({ where: { changeRequestId: In(matchingIds) } })
      : 0;
    return {
      requests: ids.map((id) => requests.find((request) => request.id === id)!),
      total,
      openItemCount,
    };
  }

  async get(id: string): Promise<{
    request: ChangeRequestEntity;
    description: unknown;
    items: { item: ChangeRequestItemEntity; liveValue: unknown }[];
  }> {
    const request = await this.load(id);
    const adapter = this.adapters.get(request.entityType, request.target);
    const [description, live] = await Promise.all([
      adapter.describe(request.entityId),
      adapter.read(request.entityId, request.items),
    ]);
    return {
      request,
      description,
      items: request.items.map((item) => ({
        item,
        liveValue: this.liveValue(live, item),
      })),
    };
  }

  async update(
    id: string,
    changes: { itemId: string; proposedValue: unknown }[],
    actor: ChangeRequestActor,
  ): Promise<ChangeRequestEntity> {
    const request = await this.load(id);
    const selected = changes.map((change) =>
      this.requireItem(request, change.itemId),
    );
    await this.adapters.get(request.entityType, request.target).validate(
      request.entityId,
      selected.map((item, index) => ({
        fieldKey: item.fieldKey,
        variant: item.variant,
        proposedValue: changes[index].proposedValue,
      })),
    );
    for (const [index, item] of selected.entries()) {
      item.proposedValue = changes[index].proposedValue;
      if (item.state === 'publish_failed') item.state = 'proposed';
      item.publishError = null;
    }
    await this.items.save(selected);
    await this.emit('updated', id, selected.length, actor);
    return this.load(id);
  }

  async approve(
    id: string,
    itemIds: string[] | 'all',
    actor: ChangeRequestActor,
  ): Promise<ChangeRequestItemResult[]> {
    const request = await this.requests.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!request) {
      if (itemIds === 'all') return [];
      return itemIds.map((itemId) => ({ itemId, status: 'alreadyResolved' }));
    }
    const selected = this.select(request, itemIds);
    const adapter = this.adapters.get(request.entityType, request.target);
    const results: ChangeRequestItemResult[] = [];
    for (const itemId of selected) {
      const item = await this.items.findOneBy({
        id: itemId,
        changeRequestId: id,
      });
      if (!item) {
        results.push({ itemId, status: 'alreadyResolved' });
        continue;
      }
      const live = this.liveValue(
        await adapter.read(request.entityId, [item]),
        item,
      );
      if (hash(live) === hash(item.proposedValue)) {
        await this.items.remove(item);
        results.push({ itemId, status: 'published' });
      } else if (hash(live) !== item.baseHash) {
        item.state = 'stale';
        await this.items.save(item);
        results.push({ itemId, status: 'stale' });
        await this.emit('stale', id, 1, actor);
      } else {
        try {
          await adapter.apply(
            request.entityId,
            [
              {
                fieldKey: item.fieldKey,
                variant: item.variant,
                value: item.proposedValue,
              },
            ],
            actor,
          );
          await this.items.remove(item);
          results.push({ itemId, status: 'published' });
        } catch (cause) {
          await this.events.logAsync('change-request.publish-cause', {
            data: { requestId: id, itemId, cause },
            logger: { level: 'error' },
            event: false,
          });
          item.state = 'publish_failed';
          item.publishError = 'Publication failed';
          await this.items.save(item);
          results.push({ itemId, status: 'publish_failed' });
          await this.emit('publish_failed', id, 1, actor);
        }
      }
    }
    await this.dropEmpty(id);
    await this.emit(
      'approved',
      id,
      results.filter((result) => result.status === 'published').length,
      actor,
    );
    return results;
  }

  async reject(
    id: string,
    itemIds: string[] | 'all',
    actor: ChangeRequestActor,
    note?: string,
  ): Promise<ChangeRequestItemResult[]> {
    const request = await this.requests.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!request) {
      if (itemIds === 'all') return [];
      return itemIds.map((itemId) => ({ itemId, status: 'alreadyResolved' }));
    }
    if (note !== undefined) {
      request.note = note;
      await this.requests.save(request);
    }
    const results: ChangeRequestItemResult[] = [];
    for (const itemId of this.select(request, itemIds)) {
      const item = request.items.find((candidate) => candidate.id === itemId);
      if (item) {
        await this.items.remove(item);
        results.push({ itemId, status: 'rejected' });
      } else results.push({ itemId, status: 'alreadyResolved' });
    }
    await this.dropEmpty(id);
    await this.emit(
      'rejected',
      id,
      results.filter((result) => result.status === 'rejected').length,
      actor,
    );
    return results;
  }

  async withdraw(id: string, actor: ChangeRequestActor): Promise<void> {
    const request = await this.load(id);
    const count = request.items.length;
    await this.requests.remove(request);
    await this.emit('withdrawn', id, count, actor);
  }

  async refresh(
    id: string,
    itemIds: string[],
    actor: ChangeRequestActor,
  ): Promise<ChangeRequestEntity> {
    const request = await this.load(id);
    const selected = itemIds.map((itemId) => this.requireItem(request, itemId));
    const live = await this.adapters
      .get(request.entityType, request.target)
      .read(request.entityId, selected);
    for (const item of selected) {
      item.baseValue = this.liveValue(live, item);
      item.baseHash = hash(item.baseValue);
      item.state = 'proposed';
      item.publishError = null;
    }
    await this.items.save(selected);
    await this.emit('updated', id, selected.length, actor);
    return this.load(id);
  }

  async retryPublish(
    id: string,
    itemIds: string[],
    actor: ChangeRequestActor,
  ): Promise<ChangeRequestItemResult[]> {
    const request = await this.load(id);
    for (const itemId of itemIds) {
      const item = this.requireItem(request, itemId);
      if (item.state !== 'publish_failed')
        throw this.events.errorBadRequest('change-request.not-failed', {
          response: { message: 'Item is not awaiting retry' },
        });
    }
    return this.approve(id, itemIds, actor);
  }

  private async load(id: string): Promise<ChangeRequestEntity> {
    const request = await this.requests.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!request)
      throw this.events.errorNotFound('change-request.not-found', {
        response: { message: 'Change request not found' },
      });
    return request;
  }

  private requireItem(
    request: ChangeRequestEntity,
    itemId: string,
  ): ChangeRequestItemEntity {
    const item = request.items.find((candidate) => candidate.id === itemId);
    if (!item)
      throw this.events.errorNotFound('change-request.item-not-found', {
        response: { message: 'Change request item not found' },
      });
    return item;
  }

  private select(
    request: ChangeRequestEntity,
    itemIds: string[] | 'all',
  ): string[] {
    return itemIds === 'all' ? request.items.map((item) => item.id) : itemIds;
  }

  private liveValue(
    values: { fieldKey: string; variant: string; value: unknown }[],
    item: { fieldKey: string; variant: string },
  ): unknown {
    const found = values.find(
      (value) =>
        value.fieldKey === item.fieldKey && value.variant === item.variant,
    );
    if (!found)
      throw this.events.errorBadRequest('change-request.missing-live-value', {
        response: { message: 'Adapter did not return a live value' },
      });
    return found.value ?? null;
  }

  private async dropEmpty(
    id: string,
    manager = this.requests.manager,
  ): Promise<void> {
    if (
      (await manager.count(ChangeRequestItemEntity, {
        where: { changeRequestId: id },
      })) === 0
    ) {
      await manager.delete(ChangeRequestEntity, id);
    }
  }

  private async emit(
    action: string,
    id: string,
    count: number,
    actor?: ChangeRequestActor,
  ): Promise<void> {
    await this.events.emitAsync(`change-request.${action}`, {
      data: { requestId: id, count, actorId: actor?.id },
    });
  }
}
