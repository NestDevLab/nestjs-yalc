import {
  createProjectionDialect,
  createProjectionSchemaOptions,
  type ProjectionDialect,
} from '@nestjs-yalc/crud-gen';
import { EntitySchema } from 'typeorm';
import { projectionRecordDefinition } from './projection-spike.definition';

export class ProjectionRecord {
  id!: number;
  scopeId!: string;
  guid!: string;
  title!: string;
  revision!: number;
  payload!: Record<string, unknown>;
  status?: string;
  plannedEnd?: string | null;
  priority?: number | null;
}

export class ProjectionRelation {
  id!: number;
  scopeId!: string;
  guid!: string;
  sourceGuid!: string;
  targetGuid!: string;
  kind!: string;
}

export function createProjectionRecordSchema(
  dialect: ProjectionDialect,
): EntitySchema<ProjectionRecord> {
  const projectionSchema = createProjectionSchemaOptions(
    projectionRecordDefinition,
    dialect,
  );
  return new EntitySchema<ProjectionRecord>({
    name: projectionRecordDefinition.tableName,
    tableName: projectionRecordDefinition.tableName,
    target: ProjectionRecord,
    columns: {
      id: { type: Number, primary: true, generated: true },
      ...projectionSchema.columns,
    },
    indices: projectionSchema.indices,
  });
}

export function createProjectionRelationSchema(): EntitySchema<ProjectionRelation> {
  return new EntitySchema<ProjectionRelation>({
    name: 'projection_spike_relation',
    tableName: 'projection_spike_relation',
    target: ProjectionRelation,
    columns: {
      id: { type: Number, primary: true, generated: true },
      scopeId: { type: String, length: 64 },
      guid: { type: String, length: 64 },
      sourceGuid: { type: String, length: 64 },
      targetGuid: { type: String, length: 64 },
      kind: { type: String, length: 64 },
    },
    indices: [
      {
        name: 'projection_spike_relation_scope_guid_unique',
        columns: ['scopeId', 'guid'],
        unique: true,
      },
      {
        name: 'projection_spike_relation_source_idx',
        columns: ['scopeId', 'sourceGuid', 'kind', 'guid'],
      },
      {
        name: 'projection_spike_relation_target_idx',
        columns: ['scopeId', 'targetGuid', 'kind', 'guid'],
      },
    ],
  });
}

export function createProjectionSpikeDialect(driver: 'sqlite' | 'postgres') {
  return createProjectionDialect(driver);
}
