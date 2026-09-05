import type { DataSource, QueryRunner } from 'typeorm';
import { DEFAULT_READ_LIMIT } from '../mutation-journal.def.js';
import type {
  IMutationJournalDriver,
  MutationJournalDriverInstallOptions,
  MutationJournalInstallReport,
  MutationJournalReadFilter,
  MutationJournalRow,
  MutationJournalSkipReason,
} from '../mutation-journal.interface.js';
import {
  buildSqliteJsonObjectExpression,
  getSqliteMutationJournalTriggerName,
  quoteSqliteIdentifier,
  quoteSqliteStringLiteral,
  SQLITE_OCCURRED_AT_EXPRESSION,
} from './sqlite-sql.helper.js';

interface SqliteTable {
  name: string;
  sql: string | null;
}

interface SqliteColumn {
  name: string;
  type: string | null;
}

interface SqliteTrigger {
  name: string;
}

export class SqliteTriggerJournalDriver implements IMutationJournalDriver {
  public readonly engine = 'sqlite';

  public supports(dataSource: DataSource): boolean {
    return (
      dataSource.options.type === 'sqlite' ||
      dataSource.options.type === 'better-sqlite3'
    );
  }

  public async install(
    dataSource: DataSource,
    options: MutationJournalDriverInstallOptions,
  ): Promise<MutationJournalInstallReport> {
    const queryRunner = dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      await this.dropJournalTriggers(queryRunner);
      await this.createJournalTable(queryRunner, options.journalTableName);

      const report: MutationJournalInstallReport = {
        dataSourceName: dataSource.name,
        engine: this.engine,
        journaledTables: [],
        skippedTables: [],
      };
      const tables = (await queryRunner.query(
        "SELECT name, sql FROM sqlite_master WHERE type = 'table'",
      )) as SqliteTable[];

      for (const table of tables) {
        const skipReason = this.getTableSkipReason(table, options);
        if (skipReason) {
          report.skippedTables.push({
            tableName: table.name,
            reason: skipReason,
          });
          continue;
        }

        const columns = (await queryRunner.query(
          `PRAGMA table_info(${quoteSqliteIdentifier(table.name)})`,
        )) as SqliteColumn[];
        const columnSkipReason = this.getColumnSkipReason(columns);
        if (columnSkipReason) {
          report.skippedTables.push({
            tableName: table.name,
            reason: columnSkipReason,
          });
          continue;
        }

        await this.createJournalTriggers(
          queryRunner,
          table.name,
          columns.map((column) => column.name),
          options.journalTableName,
        );
        report.journaledTables.push(table.name);
      }

      await queryRunner.commitTransaction();
      return report;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }
  }

  public async uninstall(
    dataSource: DataSource,
    _options: MutationJournalDriverInstallOptions,
  ): Promise<void> {
    const queryRunner = dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await this.dropJournalTriggers(queryRunner);
    } finally {
      await queryRunner.release();
    }
  }

  public async read(
    dataSource: DataSource,
    options: MutationJournalDriverInstallOptions,
    filter: MutationJournalReadFilter,
  ): Promise<MutationJournalRow[]> {
    const queryRunner = dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      const predicates: string[] = [];
      const parameters: unknown[] = [];

      if (filter.tableName !== undefined) {
        predicates.push(`${quoteSqliteIdentifier('tableName')} = ?`);
        parameters.push(filter.tableName);
      }
      if (filter.action !== undefined) {
        predicates.push(`${quoteSqliteIdentifier('action')} = ?`);
        parameters.push(filter.action);
      }
      if (filter.sinceMs !== undefined) {
        predicates.push(`${quoteSqliteIdentifier('occurredAt')} >= ?`);
        parameters.push(filter.sinceMs);
      }
      if (filter.untilMs !== undefined) {
        predicates.push(`${quoteSqliteIdentifier('occurredAt')} < ?`);
        parameters.push(filter.untilMs);
      }

      const limit = filter.limit ?? DEFAULT_READ_LIMIT;
      const offset = filter.offset ?? 0;
      parameters.push(limit, offset);
      const whereClause =
        predicates.length > 0 ? ` WHERE ${predicates.join(' AND ')}` : '';

      return (await queryRunner.query(
        `SELECT ${quoteSqliteIdentifier('id')}, ${quoteSqliteIdentifier(
          'occurredAt',
        )}, ${quoteSqliteIdentifier('tableName')}, ${quoteSqliteIdentifier(
          'action',
        )}, ${quoteSqliteIdentifier('oldRow')}, ${quoteSqliteIdentifier(
          'newRow',
        )}, ${quoteSqliteIdentifier('actor')} FROM ${quoteSqliteIdentifier(
          options.journalTableName,
        )}${whereClause} ORDER BY ${quoteSqliteIdentifier(
          'id',
        )} DESC LIMIT ? OFFSET ?`,
        parameters,
      )) as MutationJournalRow[];
    } finally {
      await queryRunner.release();
    }
  }

  private getTableSkipReason(
    table: SqliteTable,
    options: MutationJournalDriverInstallOptions,
  ): MutationJournalSkipReason | undefined {
    if (
      table.name.startsWith('sqlite_') ||
      table.name === options.journalTableName ||
      options.excludedTables.includes(table.name)
    ) {
      return 'excluded';
    }
    if (/^CREATE VIRTUAL TABLE/i.test(table.sql ?? '')) {
      return 'virtual-table';
    }

    return undefined;
  }

  private getColumnSkipReason(
    columns: SqliteColumn[],
  ): MutationJournalSkipReason | undefined {
    if (columns.length > 400) {
      return 'too-many-columns';
    }
    if (
      columns.some(
        (column) => !column.type?.trim() || /BLOB/i.test(column.type),
      )
    ) {
      return 'blob-column';
    }

    return undefined;
  }

  private async dropJournalTriggers(queryRunner: QueryRunner): Promise<void> {
    const triggers = (await queryRunner.query(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE '\\_mj\\_%' ESCAPE '\\'",
    )) as SqliteTrigger[];

    for (const trigger of triggers) {
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS ${quoteSqliteIdentifier(trigger.name)}`,
      );
    }
  }

  private async createJournalTable(
    queryRunner: QueryRunner,
    journalTableName: string,
  ): Promise<void> {
    const table = quoteSqliteIdentifier(journalTableName);
    const column = (name: string) => quoteSqliteIdentifier(name);

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS ${table} (${column(
        'id',
      )} INTEGER PRIMARY KEY AUTOINCREMENT, ${column(
        'occurredAt',
      )} INTEGER NOT NULL, ${column('tableName')} TEXT NOT NULL, ${column(
        'action',
      )} TEXT NOT NULL, ${column('oldRow')} TEXT, ${column(
        'newRow',
      )} TEXT, ${column('actor')} TEXT)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ${quoteSqliteIdentifier(
        `idx_${journalTableName}_occurredAt`,
      )} ON ${table} (${column('occurredAt')})`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ${quoteSqliteIdentifier(
        `idx_${journalTableName}_table`,
      )} ON ${table} (${column('tableName')}, ${column('occurredAt')})`,
    );
  }

  private async createJournalTriggers(
    queryRunner: QueryRunner,
    tableName: string,
    columns: string[],
    journalTableName: string,
  ): Promise<void> {
    for (const action of ['insert', 'update', 'delete'] as const) {
      const oldRow =
        action === 'insert'
          ? 'NULL'
          : buildSqliteJsonObjectExpression('OLD', columns);
      const newRow =
        action === 'delete'
          ? 'NULL'
          : buildSqliteJsonObjectExpression('NEW', columns);
      const triggerName = getSqliteMutationJournalTriggerName(
        action,
        tableName,
      );

      await queryRunner.query(
        `CREATE TRIGGER ${quoteSqliteIdentifier(
          triggerName,
        )} AFTER ${action.toUpperCase()} ON ${quoteSqliteIdentifier(
          tableName,
        )} BEGIN INSERT INTO ${quoteSqliteIdentifier(
          journalTableName,
        )} (${quoteSqliteIdentifier('occurredAt')}, ${quoteSqliteIdentifier(
          'tableName',
        )}, ${quoteSqliteIdentifier('action')}, ${quoteSqliteIdentifier(
          'oldRow',
        )}, ${quoteSqliteIdentifier('newRow')}, ${quoteSqliteIdentifier(
          'actor',
        )}) VALUES (${SQLITE_OCCURRED_AT_EXPRESSION}, ${quoteSqliteStringLiteral(
          tableName,
        )}, ${quoteSqliteStringLiteral(
          action,
        )}, ${oldRow}, ${newRow}, NULL); END`,
      );
    }
  }
}
