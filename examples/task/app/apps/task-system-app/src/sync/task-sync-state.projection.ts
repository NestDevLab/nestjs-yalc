import {
  defineProjectionResource,
  type ProjectionScope,
} from '@nestjs-yalc/crud-gen';
import {
  OmniRecordEntity,
  OmniRecordStatus,
} from '@nestjs-yalc/omnikernel-module';
import { ChildEntity } from 'typeorm';

export const TASK_SYNC_STATE_KIND = 'sync-state';

/**
 * The Task App currently has one server-configured development partition.
 * It is deliberately not derived from request input or exposed in the API.
 */
export const taskSyncStateProjectionScope: ProjectionScope = {
  scopeId: 'default',
  cacheKey: (key) => `default:${key}`,
};

export const taskSyncStateProjectionDefinition = defineProjectionResource({
  id: 'task-system.sync-state.v1',
  tableName: 'omni-record',
  identity: { column: 'guid', uniqueWithinScope: true },
  scope: { column: 'scopeId', serverOwned: true },
  revision: { column: 'revision' },
  payload: { column: 'payload', allowCreate: false },
  deletion: 'hard',
  fields: [
    {
      name: 'guid',
      storage: 'column',
      column: 'guid',
      codec: 'uuid',
      nullable: false,
      requiredOnCreate: true,
    },
    {
      name: 'externalRefId',
      storage: 'json',
      path: ['externalRefId'],
      codec: 'uuid',
      nullable: false,
      requiredOnCreate: true,
      query: { filter: ['eq'], sort: true },
      index: { name: 'task_sync_state_external_ref_idx' },
    },
    {
      name: 'status',
      storage: 'json',
      path: ['syncStatus'],
      codec: 'string',
      nullable: false,
      requiredOnCreate: true,
      query: { filter: ['eq'], sort: true },
      index: { name: 'task_sync_state_status_idx' },
    },
    {
      name: 'lastSyncedAt',
      storage: 'json',
      path: ['lastSyncedAt'],
      codec: 'instant',
      nullable: true,
      query: { filter: ['eq', 'range'], sort: true },
      index: { name: 'task_sync_state_last_synced_at_idx' },
    },
    {
      name: 'lastDirection',
      storage: 'json',
      path: ['lastDirection'],
      codec: 'string',
      nullable: true,
      query: { filter: ['eq'], sort: true },
    },
    {
      name: 'remoteVersion',
      storage: 'json',
      path: ['remoteVersion'],
      codec: 'string',
      nullable: true,
      query: { filter: ['eq'], sort: true },
    },
    {
      name: 'localVersionHash',
      storage: 'json',
      path: ['localVersionHash'],
      codec: 'string',
      nullable: true,
      query: { filter: ['eq'], sort: true },
    },
    {
      name: 'lastError',
      storage: 'json',
      path: ['lastError'],
      codec: 'string',
      nullable: true,
    },
  ],
});

/**
 * API-only model for CrudGen. Keeping it separate from the STI entity prevents
 * Omni's internal graph relations from becoming Task App GraphQL fields.
 */
export class TaskSyncStateProjectionApi {
  guid!: string;
  externalRefId!: string;
  status!: string;
  lastSyncedAt?: string | null;
  lastDirection?: string | null;
  remoteVersion?: string | null;
  localVersionHash?: string | null;
  lastError?: string | null;
  revision!: number;
  payload?: Record<string, unknown>;
}

/**
 * Keeps the existing Omni record shape valid while CrudGen owns all public
 * sync-state fields in the projection payload.
 */
@ChildEntity(TASK_SYNC_STATE_KIND)
export class TaskSyncStateProjection extends OmniRecordEntity {
  kind = TASK_SYNC_STATE_KIND;
  status = OmniRecordStatus.Active;
  title = 'Sync state';
}
