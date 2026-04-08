import { Injectable } from '@nestjs/common';
import {
  OmniCollectionEntity,
  OmniCollectionKind,
  OmniExternalRefEntity,
  OmniExternalRefInternalType,
  OmniRecordEntity,
  OmniRecordStatus,
} from '@nestjs-yalc/omnikernel-module';
import {
  TaskExternalRef,
  TaskExternalRefType,
  TaskItem,
  TaskItemType,
  TaskProject,
  TaskProjectType,
} from '@nestjs-yalc/task-system-module';

export interface TaskItemOmniWriteInput extends Partial<TaskItem> {
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

  mapProjectToOmniCollection(
    input: Partial<TaskProject>,
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
    tasks?: TaskItemType[],
  ): TaskProjectType {
    const payload = this.getPayload(collection);
    return new TaskProjectType({
      guid: collection.guid,
      name: collection.title,
      description: collection.summary ?? null,
      status:
        this.getPayloadString(payload, 'projectStatus') ??
        this.mapOmniStatusToDomainStatus(collection.status),
      tasks,
      events: [],
    });
  }

  mapTaskToOmniRecord(input: Partial<TaskItem>): Partial<OmniRecordEntity> {
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

  mapExternalRefToOmniExternalRef(
    input: Partial<TaskExternalRef>,
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

  buildPage<T>(list: T[], startRow: number, count: number) {
    return {
      list,
      pageData: {
        count,
        endRow: startRow + list.length,
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
}
