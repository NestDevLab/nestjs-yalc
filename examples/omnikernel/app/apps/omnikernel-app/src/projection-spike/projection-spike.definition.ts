import { defineProjectionResource } from '@nestjs-yalc/crud-gen';

export const projectionRecordDefinition = defineProjectionResource({
  id: 'omnikernel.projection-spike.record.v1',
  tableName: 'projection_spike_record',
  identity: { column: 'guid', uniqueWithinScope: true },
  scope: { column: 'scopeId', serverOwned: true },
  revision: { column: 'revision' },
  payload: { column: 'payload', allowCreate: true },
  deletion: 'hard',
  fields: [
    {
      name: 'guid',
      storage: 'column',
      column: 'guid',
      codec: 'string',
      nullable: false,
      requiredOnCreate: true,
    },
    {
      name: 'title',
      storage: 'column',
      column: 'title',
      codec: 'string',
      nullable: false,
      requiredOnCreate: true,
      query: { filter: ['eq'], sort: true },
    },
    {
      name: 'status',
      storage: 'json',
      path: ['workflow', 'status'],
      codec: 'string',
      nullable: false,
      requiredOnCreate: true,
      query: { filter: ['eq'], sort: true },
      index: { name: 'projection_spike_record_status_idx' },
    },
    {
      name: 'plannedEnd',
      storage: 'json',
      path: ['workflow', 'plan', 'end'],
      codec: 'instant',
      nullable: true,
      query: { filter: ['eq', 'range'], sort: true },
      index: { name: 'projection_spike_record_planned_end_idx' },
    },
    {
      name: 'priority',
      storage: 'json',
      path: ['workflow', 'priority'],
      codec: 'integer',
      nullable: true,
      query: { filter: ['eq', 'range'], sort: true },
      index: { name: 'projection_spike_record_priority_idx' },
    },
  ],
});

export const projectionRelationDefinition = {
  identity: 'guid',
  scope: 'scopeId',
  source: 'sourceGuid',
  target: 'targetGuid',
  fields: ['guid', 'sourceGuid', 'targetGuid', 'kind'],
  mutableFields: ['kind'],
  deletion: 'hard',
} as const;
