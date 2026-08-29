import type { DataSource } from 'typeorm';

export interface OmniKernelQueryPlanEvidence {
  dialect: 'sqlite' | 'postgres';
  recordGridPlan: readonly string[];
  relationSourcePlan: readonly string[];
  usesRecordGridIndex: boolean;
  usesRelationSourceIndex: boolean;
}

const recordGridIndex = 'omni_record_scope_kind_status_guid_idx';
const relationSourceIndex =
  'omni_relation_scope_source_kind_status_created_guid_idx';

/**
 * Bounded operator evidence for the two high-fanout generated read shapes.
 * This is diagnostic-only: CRUD continues to use the normal TypeORM path.
 */
export async function collectOmniKernelQueryPlanEvidence(
  dataSource: DataSource,
  sample: {
    scopeId: string;
    recordKind: string;
    recordStatus: string;
    sourceRecordId: string;
    relationKind: string;
    relationStatus: string;
  },
): Promise<OmniKernelQueryPlanEvidence> {
  const dialect = dataSource.options.type;
  if (dialect !== 'sqlite' && dialect !== 'postgres') {
    throw new TypeError(
      'OmniKernel diagnostics support sqlite and postgres only.',
    );
  }

  const statements =
    dialect === 'sqlite'
      ? {
          record: `EXPLAIN QUERY PLAN SELECT "guid" FROM "omni-record" WHERE "scopeId" = ? AND "kind" = ? AND "status" = ? AND "deletedAt" IS NULL ORDER BY "guid"`,
          relation: `EXPLAIN QUERY PLAN SELECT "guid" FROM "omni-relation" WHERE "scopeId" = ? AND "sourceRecordId" = ? AND "kind" = ? AND "status" = ? ORDER BY "createdAt", "guid"`,
        }
      : {
          record: `EXPLAIN (FORMAT JSON) SELECT "guid" FROM "omni-record" WHERE "scopeId" = $1 AND "kind" = $2 AND "status" = $3 AND "deletedAt" IS NULL ORDER BY "guid"`,
          relation: `EXPLAIN (FORMAT JSON) SELECT "guid" FROM "omni-relation" WHERE "scopeId" = $1 AND "sourceRecordId" = $2 AND "kind" = $3 AND "status" = $4 ORDER BY "createdAt", "guid"`,
        };

  const recordResult = await dataSource.query(statements.record, [
    sample.scopeId,
    sample.recordKind,
    sample.recordStatus,
  ]);
  const relationResult = await dataSource.query(statements.relation, [
    sample.scopeId,
    sample.sourceRecordId,
    sample.relationKind,
    sample.relationStatus,
  ]);
  const recordGridPlan = flattenPlan(recordResult);
  const relationSourcePlan = flattenPlan(relationResult);

  return {
    dialect,
    recordGridPlan,
    relationSourcePlan,
    usesRecordGridIndex: containsIndex(recordGridPlan, recordGridIndex),
    usesRelationSourceIndex: containsIndex(
      relationSourcePlan,
      relationSourceIndex,
    ),
  };
}

function flattenPlan(result: unknown): string[] {
  return JSON.stringify(result)
    .replaceAll('\\n', ' ')
    .split(/(?<=\}),|\n/)
    .filter((line) => line.length > 0);
}

function containsIndex(plan: readonly string[], indexName: string): boolean {
  return plan.some((line) => line.includes(indexName));
}
