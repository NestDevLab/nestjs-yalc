import { Injectable } from '@nestjs/common';
import {
  OmniCollectionEntity,
  OmniCollectionKind,
  OmniExternalRefEntity,
  OmniExternalRefInternalType,
  OmniRecordEntity,
  OmniRecordStatus,
} from '@nestjs-yalc/omnikernel-module';
import { TaskItemCreateInput, TaskItemType } from '../tasks/task-item.dto';
import {
  TaskProjectCreateInput,
  TaskProjectType,
} from '../projects/task-project.dto';
import { TaskEventCreateInput, TaskEventType } from '../events/task-event.dto';
import {
  TaskExternalRefCreateInput,
  TaskExternalRefType,
} from '../sync/task-external-ref.dto';
import {
  TaskSyncStateCreateInput,
  TaskSyncStateType,
} from '../sync/task-sync-state.dto';

export interface TaskItemOmniWriteInput extends Partial<TaskItemCreateInput> {
  referenceIds?: string[];
  relatedToIds?: string[];
}

export interface TaskOmniPageQuery {
  endRow?: number | string;
  projectId?: string;
  provider?: string;
  startRow?: number | string;
}

@Injectable()
export class TaskAppOmniMapper {
  readonly taskKind = 'task';
  readonly eventKind = 'event';
  readonly syncStateKind = 'sync-state';

  extractCrudGenFilterMap(where: unknown): Record<string, unknown> {
    if (!where || typeof where !== 'object' || Array.isArray(where)) {
      return {};
    }

    const source = where as {
      filters?: Record<string, unknown>;
      childExpressions?: unknown[];
    } & Record<string, unknown>;

    const filters = source.filters ? { ...source.filters } : { ...source };
    delete filters.filters;
    delete filters.operator;
    delete filters.childExpressions;

    for (const childExpression of source.childExpressions ?? []) {
      Object.assign(filters, this.extractCrudGenFilterMap(childExpression));
    }

    return filters;
  }

  mapProjectToOmniCollection(
    input: Partial<TaskProjectCreateInput>,
  ): Partial<OmniCollectionEntity> {
    const projectStatus = input.status ?? 'active';
    return {
      guid: input.guid,
      title: input.name ?? 'Untitled project',
      slug: this.slugify(input.name),
      kind: OmniCollectionKind.Collection,
      collectionKind: OmniCollectionKind.Collection,
      status: this.mapDomainStatusToOmniStatus(projectStatus),
      summary: input.description ?? null,
      payload: {
        projectStatus,
      },
    };
  }

  mapOmniCollectionToProject(
    collection: OmniCollectionEntity,
  ): TaskProjectType {
    const payload = this.getPayload(collection);
    return new TaskProjectType({
      guid: collection.guid,
      name: collection.title,
      description: collection.summary ?? null,
      status:
        this.getPayloadString(payload, 'projectStatus') ??
        this.mapOmniStatusToDomainStatus(collection.status),
    });
  }

  mapTaskToOmniRecord(
    input: Partial<TaskItemCreateInput>,
  ): Partial<OmniRecordEntity> {
    const taskStatus = input.status ?? 'todo';
    return {
      guid: input.guid,
      title: input.title ?? 'Untitled task',
      slug: this.slugify(input.title),
      kind: this.taskKind,
      status: this.mapDomainStatusToOmniStatus(taskStatus),
      payload: {
        description: input.description ?? null,
        dueAt: this.normalizeDateInput(input.dueAt),
        taskStatus,
      },
    };
  }

  mapOmniRecordToTask(
    record: OmniRecordEntity,
    projectId?: string | null,
  ): TaskItemType {
    const payload = this.getPayload(record);
    return new TaskItemType({
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      guid: record.guid,
      title: record.title,
      description: this.getPayloadString(payload, 'description'),
      status:
        this.getPayloadString(payload, 'taskStatus') ??
        this.mapOmniStatusToDomainStatus(record.status),
      projectId: projectId ?? null,
      dueAt: this.getPayloadDate(payload, 'dueAt'),
    });
  }

  mapEventToOmniRecord(
    input: Partial<TaskEventCreateInput>,
  ): Partial<OmniRecordEntity> {
    const eventStatus = input.status ?? 'scheduled';
    return {
      guid: input.guid,
      title: input.title ?? 'Untitled event',
      slug: this.slugify(input.title),
      kind: this.eventKind,
      status: this.mapDomainStatusToOmniStatus(eventStatus),
      payload: {
        allDay: input.allDay ?? false,
        description: input.description ?? null,
        endAt: this.normalizeDateInput(input.endAt),
        eventStatus,
        location: input.location ?? null,
        startAt: this.normalizeDateInput(input.startAt),
      },
    };
  }

  mapOmniRecordToEvent(
    record: OmniRecordEntity,
    projectId?: string | null,
  ): TaskEventType {
    const payload = this.getPayload(record);
    return new TaskEventType({
      guid: record.guid,
      title: record.title,
      description: this.getPayloadString(payload, 'description'),
      status:
        this.getPayloadString(payload, 'eventStatus') ??
        this.mapOmniStatusToDomainStatus(record.status),
      startAt: this.getPayloadDate(payload, 'startAt') ?? new Date(0),
      endAt: this.getPayloadDate(payload, 'endAt'),
      allDay: this.getPayloadBoolean(payload, 'allDay') ?? false,
      projectId: projectId ?? null,
      location: this.getPayloadString(payload, 'location'),
    });
  }

  mapSyncStateToOmniRecord(
    input: Partial<TaskSyncStateCreateInput>,
  ): Partial<OmniRecordEntity> {
    const syncStatus = input.status ?? 'active';
    return {
      guid: input.guid,
      title: `Sync state ${input.guid ?? 'unknown'}`,
      slug: this.slugify(input.guid),
      kind: this.syncStateKind,
      status: this.mapDomainStatusToOmniStatus(syncStatus),
      payload: {
        externalRefId: input.externalRefId,
        lastDirection: input.lastDirection ?? null,
        lastError: input.lastError ?? null,
        lastSyncedAt: this.normalizeDateInput(input.lastSyncedAt),
        localVersionHash: input.localVersionHash ?? null,
        remoteVersion: input.remoteVersion ?? null,
        syncStatus,
      },
    };
  }

  mapOmniRecordToSyncState(record: OmniRecordEntity): TaskSyncStateType {
    const payload = this.getPayload(record);
    return new TaskSyncStateType({
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      guid: record.guid,
      externalRefId: this.getPayloadString(payload, 'externalRefId') ?? '',
      status:
        this.getPayloadString(payload, 'syncStatus') ??
        this.mapOmniStatusToDomainStatus(record.status),
      lastSyncedAt: this.getPayloadDate(payload, 'lastSyncedAt'),
      lastDirection: this.getPayloadString(payload, 'lastDirection'),
      remoteVersion: this.getPayloadString(payload, 'remoteVersion'),
      localVersionHash: this.getPayloadString(payload, 'localVersionHash'),
      lastError: this.getPayloadString(payload, 'lastError'),
    });
  }

  mapExternalRefToOmniExternalRef(
    input: Partial<TaskExternalRefCreateInput>,
  ): Partial<OmniExternalRefEntity> {
    const legacyInternalType =
      input.internalType ??
      this.mapOmniExternalRefInternalTypeToTaskType(
        this.mapTaskExternalRefInternalType(undefined),
      );

    return {
      guid: input.guid,
      internalType: this.mapTaskExternalRefInternalType(input.internalType),
      internalId: input.internalId,
      provider: input.provider,
      account: input.account ?? null,
      container: input.container ?? null,
      externalId: input.externalId,
      payload: {
        legacyInternalType,
      },
    };
  }

  mapOmniExternalRefToTask(ref: OmniExternalRefEntity): TaskExternalRefType {
    const payload = this.getPayload(ref);
    return new TaskExternalRefType({
      createdAt: ref.createdAt,
      updatedAt: ref.updatedAt,
      guid: ref.guid,
      internalType:
        this.getPayloadString(payload, 'legacyInternalType') ??
        this.mapOmniExternalRefInternalTypeToTaskType(ref.internalType),
      internalId: ref.internalId,
      provider: ref.provider,
      account: ref.account ?? null,
      container: ref.container ?? null,
      externalId: ref.externalId,
    });
  }

  mapTaskExternalRefInternalType(
    value?: string | null,
  ): OmniExternalRefInternalType {
    switch (value) {
      case 'collection':
      case 'project':
        return OmniExternalRefInternalType.Collection;
      case 'document':
        return OmniExternalRefInternalType.Document;
      case 'record':
      case 'task':
      case 'event':
      case 'sync-state':
      case undefined:
      case null:
        return OmniExternalRefInternalType.Record;
      default:
        return OmniExternalRefInternalType.Record;
    }
  }

  mapOmniExternalRefInternalTypeToTaskType(
    value: OmniExternalRefInternalType,
  ): string {
    switch (value) {
      case OmniExternalRefInternalType.Collection:
        return 'project';
      case OmniExternalRefInternalType.Document:
        return 'document';
      case OmniExternalRefInternalType.Record:
      default:
        return 'task';
    }
  }

  mapDomainStatusToOmniStatus(status?: string | null): OmniRecordStatus {
    switch (status) {
      case 'todo':
      case 'draft':
        return OmniRecordStatus.Draft;
      case 'done':
      case 'archived':
      case 'cancelled':
        return OmniRecordStatus.Archived;
      case 'active':
      case 'in_progress':
      case 'scheduled':
      case 'error':
      default:
        return OmniRecordStatus.Active;
    }
  }

  mapOmniStatusToDomainStatus(status: OmniRecordStatus): string {
    switch (status) {
      case OmniRecordStatus.Draft:
        return 'todo';
      case OmniRecordStatus.Archived:
        return 'done';
      case OmniRecordStatus.Active:
      default:
        return 'active';
    }
  }

  normalizeDateInput(value?: Date | string | null): string | null {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  parsePageQuery(query: TaskOmniPageQuery) {
    const startRow = this.parseInteger(query.startRow, 0);
    const endRow = this.parseInteger(query.endRow, startRow + 100);
    const take = Math.max(endRow - startRow, 0);

    return {
      startRow,
      endRow,
      skip: startRow,
      take,
    };
  }

  buildPage<T>(nodes: T[], startRow: number, count: number) {
    return {
      list: nodes,
      nodes,
      pageData: {
        count,
        endRow: startRow + nodes.length,
        startRow,
      },
    };
  }

  slugify(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized.length > 0 ? normalized : null;
  }

  private parseInteger(value: number | string | undefined, fallback: number) {
    const parsed =
      typeof value === 'number' ? value : Number.parseInt(value ?? '', 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  private getPayload(
    entity: Pick<OmniRecordEntity | OmniExternalRefEntity, 'payload'>,
  ): Record<string, unknown> {
    return entity.payload && typeof entity.payload === 'object'
      ? entity.payload
      : {};
  }

  private getPayloadString(
    payload: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = payload[key];
    return typeof value === 'string' ? value : null;
  }

  private getPayloadDate(
    payload: Record<string, unknown>,
    key: string,
  ): Date | null {
    const value = payload[key];
    if (typeof value !== 'string') {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private getPayloadBoolean(
    payload: Record<string, unknown>,
    key: string,
  ): boolean | null {
    const value = payload[key];
    return typeof value === 'boolean' ? value : null;
  }
}
