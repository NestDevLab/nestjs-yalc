import type { MutationJournalAction } from '../mutation-journal.interface.js';

const SQLITE_JSON_OBJECT_COLUMN_CHUNK_SIZE = 40;

const SQLITE_TRIGGER_ACTION_SUFFIX: Record<MutationJournalAction, string> = {
  insert: 'ai',
  update: 'au',
  delete: 'ad',
};

export const SQLITE_OCCURRED_AT_EXPRESSION =
  "CAST(ROUND((julianday('now') - 2440587.5) * 86400000) AS INTEGER)";

export type SqliteTriggerRowReference = 'OLD' | 'NEW';

export function quoteSqliteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function quoteSqliteStringLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildSqliteJsonObjectExpression(
  rowReference: SqliteTriggerRowReference,
  columns: readonly string[],
): string {
  const chunks: string[] = [];

  for (
    let index = 0;
    index < columns.length;
    index += SQLITE_JSON_OBJECT_COLUMN_CHUNK_SIZE
  ) {
    const pairs = columns
      .slice(index, index + SQLITE_JSON_OBJECT_COLUMN_CHUNK_SIZE)
      .flatMap((column) => [
        quoteSqliteStringLiteral(column),
        `${rowReference}.${quoteSqliteIdentifier(column)}`,
      ]);

    chunks.push(`json_object(${pairs.join(', ')})`);
  }

  if (chunks.length === 0) {
    return 'json_object()';
  }

  if (chunks.length === 1) {
    return chunks[0];
  }

  return `(
    SELECT json_group_object(entry.key, entry.value)
    FROM json_each(json_array(${chunks.join(', ')})) AS chunk
    CROSS JOIN json_each(chunk.value) AS entry
  )`;
}

export function getSqliteMutationJournalTriggerName(
  action: MutationJournalAction,
  tableName: string,
): string {
  return `_mj_${SQLITE_TRIGGER_ACTION_SUFFIX[action]}__${tableName}`;
}
