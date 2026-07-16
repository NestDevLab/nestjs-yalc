import { describe, expect, it } from '@jest/globals';
import sqlite3 from 'sqlite3';
import {
  buildSqliteJsonObjectExpression,
  getSqliteMutationJournalTriggerName,
  quoteSqliteIdentifier,
  quoteSqliteStringLiteral,
  SQLITE_OCCURRED_AT_EXPRESSION,
} from '../sqlite/sqlite-sql.helper.js';

function runSqlite(database: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    database.run(sql, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function getSqliteRow<Row>(
  database: sqlite3.Database,
  sql: string,
): Promise<Row> {
  return new Promise((resolve, reject) => {
    database.get(sql, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      if (row === undefined) {
        reject(new Error('Expected the SQLite query to return a row.'));
        return;
      }

      resolve(row as Row);
    });
  });
}

function closeSqlite(database: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    database.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

describe('sqlite SQL helpers', () => {
  it('quotes identifiers and string literals safely', () => {
    expect(quoteSqliteIdentifier('orders')).toBe('"orders"');
    expect(quoteSqliteIdentifier('a"b')).toBe('"a""b"');
    expect(quoteSqliteIdentifier('caffè')).toBe('"caffè"');
    expect(quoteSqliteStringLiteral('orders')).toBe("'orders'");
    expect(quoteSqliteStringLiteral("O'Reilly")).toBe("'O''Reilly'");
    expect(quoteSqliteStringLiteral('caffè')).toBe("'caffè'");
  });

  it('generates json_object expressions for a row reference', () => {
    expect(buildSqliteJsonObjectExpression('NEW', ['id', 'display name'])).toBe(
      'json_object(\'id\', NEW."id", \'display name\', NEW."display name")',
    );
    expect(buildSqliteJsonObjectExpression('OLD', [])).toBe('json_object()');
  });

  it('chunks wide JSON expressions into aggregated json_object chunks', () => {
    const columns41 = Array.from(
      { length: 41 },
      (_, index) => `column${index}`,
    );
    const expression41 = buildSqliteJsonObjectExpression('OLD', columns41);
    const columns81 = Array.from(
      { length: 81 },
      (_, index) => `column${index}`,
    );
    const expression81 = buildSqliteJsonObjectExpression('OLD', columns81);

    expect(expression41).toContain(
      'SELECT json_group_object(entry.key, entry.value)',
    );
    expect(expression41).toContain('FROM json_each(json_array(json_object(');
    expect(expression41.match(/json_object\(/g)).toHaveLength(2);
    expect(expression41).not.toContain('json_patch(');
    expect(expression81).toContain(
      'SELECT json_group_object(entry.key, entry.value)',
    );
    expect(expression81.match(/json_object\(/g)).toHaveLength(3);
    expect(expression81).not.toContain('json_patch(');
    expect(expression81).toContain('\'column40\', OLD."column40"');
    expect(expression81).toContain('\'column80\', OLD."column80"');
  });

  it('preserves a SQL NULL in a later chunk as JSON null', async () => {
    const nullableColumn = `column 40 "O'Reilly"`;
    const columns = Array.from({ length: 41 }, (_, index) =>
      index === 40 ? nullableColumn : `column${index}`,
    );
    const database = new sqlite3.Database(':memory:');
    const quotedColumns = columns.map(quoteSqliteIdentifier).join(', ');
    const columnDefinitions = columns
      .map((column) => `${quoteSqliteIdentifier(column)} TEXT`)
      .join(', ');
    const values = columns
      .map((column) =>
        column === nullableColumn ? 'NULL' : quoteSqliteStringLiteral(column),
      )
      .join(', ');
    const expression = buildSqliteJsonObjectExpression('NEW', columns);

    try {
      await runSqlite(database, `CREATE TABLE source (${columnDefinitions})`);
      await runSqlite(database, 'CREATE TABLE journal (payload TEXT NOT NULL)');
      await runSqlite(
        database,
        `
          CREATE TRIGGER source_insert
          AFTER INSERT ON source
          BEGIN
            INSERT INTO journal (payload) VALUES (${expression});
          END
        `,
      );
      await runSqlite(
        database,
        `INSERT INTO source (${quotedColumns}) VALUES (${values})`,
      );

      const row = await getSqliteRow<{ payload: string }>(
        database,
        'SELECT payload FROM journal',
      );
      const payload = JSON.parse(row.payload) as Record<string, unknown>;

      expect(payload).toHaveProperty('column0', 'column0');
      expect(payload).toHaveProperty(nullableColumn, null);
      expect(Object.keys(payload)).toHaveLength(41);
    } finally {
      await closeSqlite(database);
    }
  });

  it('uses the required millisecond expression and trigger names', () => {
    expect(SQLITE_OCCURRED_AT_EXPRESSION).toBe(
      "CAST(ROUND((julianday('now') - 2440587.5) * 86400000) AS INTEGER)",
    );
    expect(getSqliteMutationJournalTriggerName('insert', 'orders')).toBe(
      '_mj_ai__orders',
    );
    expect(getSqliteMutationJournalTriggerName('update', 'orders')).toBe(
      '_mj_au__orders',
    );
    expect(getSqliteMutationJournalTriggerName('delete', 'orders')).toBe(
      '_mj_ad__orders',
    );
  });
});
