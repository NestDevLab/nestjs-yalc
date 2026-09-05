import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import {
  DEFAULT_JOURNAL_TABLE,
  DEFAULT_READ_LIMIT,
} from '../mutation-journal.def.js';
import type { MutationJournalDriverInstallOptions } from '../mutation-journal.interface.js';
import {
  quoteSqliteIdentifier,
  quoteSqliteStringLiteral,
} from '../sqlite/sqlite-sql.helper.js';
import { SqliteTriggerJournalDriver } from '../sqlite/sqlite-trigger-journal.driver.js';

const journalOptions: MutationJournalDriverInstallOptions = {
  journalTableName: DEFAULT_JOURNAL_TABLE,
  excludedTables: [],
};

const driver = new SqliteTriggerJournalDriver();
let dataSources: DataSource[] = [];

async function createDataSource(): Promise<DataSource> {
  const dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });

  await dataSource.initialize();
  dataSources.push(dataSource);
  return dataSource;
}

async function countJournalRows(dataSource: DataSource): Promise<number> {
  const rows = (await dataSource.query(
    `SELECT COUNT(*) AS count FROM ${quoteSqliteIdentifier(DEFAULT_JOURNAL_TABLE)}`,
  )) as Array<{ count: number }>;

  return rows[0].count;
}

afterEach(async () => {
  await Promise.all(dataSources.map((dataSource) => dataSource.destroy()));
  dataSources = [];
});

describe('SqliteTriggerJournalDriver', () => {
  it('supports SQLite variants only', () => {
    expect(driver.supports({ options: { type: 'sqlite' } } as DataSource)).toBe(
      true,
    );
    expect(
      driver.supports({ options: { type: 'better-sqlite3' } } as DataSource),
    ).toBe(true);
    expect(driver.supports({ options: { type: 'postgres' } } as DataSource)).toBe(
      false,
    );
  });

  it('installs idempotent triggers that journal insert, update, no-op update, and delete', async () => {
    const dataSource = await createDataSource();
    await dataSource.query(
      'CREATE TABLE widgets (id INTEGER PRIMARY KEY, label TEXT, note TEXT)',
    );
    await dataSource.query(
      'CREATE TRIGGER "_mj_ai__ghost" AFTER INSERT ON widgets BEGIN SELECT 1; END',
    );

    const report = await driver.install(dataSource, journalOptions);
    const triggers = (await dataSource.query(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE '_mj_%' ORDER BY name",
    )) as Array<{ name: string }>;
    const indexes = (await dataSource.query(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ${quoteSqliteStringLiteral(DEFAULT_JOURNAL_TABLE)}`,
    )) as Array<{ name: string }>;

    expect(report.journaledTables).toEqual(['widgets']);
    expect(report.skippedTables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tableName: DEFAULT_JOURNAL_TABLE,
          reason: 'excluded',
        }),
        expect.objectContaining({
          tableName: 'sqlite_sequence',
          reason: 'excluded',
        }),
      ]),
    );
    expect(triggers.map((trigger) => trigger.name)).toEqual([
      '_mj_ad__widgets',
      '_mj_ai__widgets',
      '_mj_au__widgets',
    ]);
    expect(indexes.map((index) => index.name)).toEqual(
      expect.arrayContaining([
        `idx_${DEFAULT_JOURNAL_TABLE}_occurredAt`,
        `idx_${DEFAULT_JOURNAL_TABLE}_table`,
      ]),
    );

    await dataSource.query(
      "INSERT INTO widgets (id, label, note) VALUES (1, 'first', NULL)",
    );
    await dataSource.query("UPDATE widgets SET label = 'second' WHERE id = 1");
    await dataSource.query("UPDATE widgets SET label = 'second' WHERE id = 1");
    await dataSource.query('DELETE FROM widgets WHERE id = 1');

    const rows = await driver.read(dataSource, journalOptions, {});

    expect(rows.map((row) => row.action)).toEqual([
      'delete',
      'update',
      'update',
      'insert',
    ]);
    expect(rows.every((row) => row.tableName === 'widgets')).toBe(true);
    expect(rows.every((row) => row.actor === null)).toBe(true);
    expect(rows.every((row) => row.occurredAt <= Date.now())).toBe(true);
    expect(JSON.parse(rows[3].newRow ?? '')).toEqual({
      id: 1,
      label: 'first',
      note: null,
    });
    expect(JSON.parse(rows[2].oldRow ?? '')).toEqual({
      id: 1,
      label: 'first',
      note: null,
    });
    expect(JSON.parse(rows[0].oldRow ?? '')).toEqual({
      id: 1,
      label: 'second',
      note: null,
    });
    expect(rows[0].newRow).toBeNull();
    expect(rows[3].oldRow).toBeNull();

    await driver.install(dataSource, journalOptions);
    const secondInstallTriggers = (await dataSource.query(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE '_mj_%'",
    )) as Array<{ name: string }>;
    expect(secondInstallTriggers).toHaveLength(3);
    expect(await countJournalRows(dataSource)).toBe(4);
  });

  it('rolls journal rows back with the source transaction', async () => {
    const dataSource = await createDataSource();
    await dataSource.query('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');
    await driver.install(dataSource, journalOptions);

    await expect(
      dataSource.transaction(async (manager) => {
        await manager.query("INSERT INTO items (id, name) VALUES (1, 'draft')");
        throw new Error('abort source mutation');
      }),
    ).rejects.toThrow('abort source mutation');

    expect(await countJournalRows(dataSource)).toBe(0);
  });

  it('rolls its installation transaction back when trigger setup fails', async () => {
    const dataSource = await createDataSource();
    await dataSource.query('CREATE TABLE failed_setup (id INTEGER PRIMARY KEY)');
    const queryRunner = dataSource.createQueryRunner();
    const query = queryRunner.query.bind(queryRunner);
    const rollbackTransaction = jest.spyOn(queryRunner, 'rollbackTransaction');
    const createQueryRunner = jest
      .spyOn(dataSource, 'createQueryRunner')
      .mockReturnValue(queryRunner);

    jest
      .spyOn(queryRunner, 'query')
      .mockImplementation(async (...args) => {
        if (args[0].startsWith('CREATE TRIGGER')) {
          throw new Error('trigger creation failed');
        }

        return query(...args);
      });

    await expect(driver.install(dataSource, journalOptions)).rejects.toThrow(
      'trigger creation failed',
    );

    expect(rollbackTransaction).toHaveBeenCalledTimes(1);
    createQueryRunner.mockRestore();
    const journalTables = (await dataSource.query(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${quoteSqliteStringLiteral(DEFAULT_JOURNAL_TABLE)}`,
    )) as Array<{ name: string }>;
    const journalTriggers = (await dataSource.query(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE '_mj_%'",
    )) as Array<{ name: string }>;

    expect(journalTables).toEqual([]);
    expect(journalTriggers).toEqual([]);
  });

  it('reports exclusions and journals exotic and wide tables', async () => {
    const dataSource = await createDataSource();
    const wideColumns = Array.from(
      { length: 60 },
      (_, index) => `column${index} TEXT`,
    ).join(', ');
    const tooWideColumns = Array.from(
      { length: 401 },
      (_, index) => `column${index} TEXT`,
    ).join(', ');
    const exoticTable = 'odd " table';
    const exoticColumn = "column ' name";

    await dataSource.query('CREATE TABLE kept (id INTEGER PRIMARY KEY, value TEXT)');
    await dataSource.query('CREATE TABLE excluded_table (id INTEGER PRIMARY KEY)');
    await dataSource.query('CREATE TABLE blob_table (payload BLOB)');
    await dataSource.query('CREATE TABLE untyped_table (value)');
    await dataSource.query(`CREATE TABLE too_wide (${tooWideColumns})`);
    await dataSource.query(`CREATE TABLE wide_table (${wideColumns})`);
    await dataSource.query('CREATE VIRTUAL TABLE lookup USING fts5(content)');
    await dataSource.query(
      `CREATE TABLE ${quoteSqliteIdentifier(exoticTable)} (${quoteSqliteIdentifier(exoticColumn)} TEXT)`,
    );

    const report = await driver.install(dataSource, {
      ...journalOptions,
      excludedTables: ['excluded_table'],
    });
    const skipped = new Map(
      report.skippedTables.map((table) => [table.tableName, table.reason]),
    );

    expect(report.journaledTables).toEqual(
      expect.arrayContaining(['kept', 'wide_table', exoticTable]),
    );
    expect(skipped.get('excluded_table')).toBe('excluded');
    expect(skipped.get('blob_table')).toBe('blob-column');
    expect(skipped.get('untyped_table')).toBe('blob-column');
    expect(skipped.get('too_wide')).toBe('too-many-columns');
    expect(skipped.get('lookup')).toBe('virtual-table');

    await dataSource.query(
      `INSERT INTO ${quoteSqliteIdentifier(exoticTable)} (${quoteSqliteIdentifier(exoticColumn)}) VALUES (?)`,
      ['quoted value'],
    );
    await dataSource.query(
      'INSERT INTO wide_table (column0, column40, column59) VALUES (?, ?, ?)',
      ['first', null, 'last'],
    );

    const exoticRows = await driver.read(dataSource, journalOptions, {
      tableName: exoticTable,
    });
    const wideRows = await driver.read(dataSource, journalOptions, {
      tableName: 'wide_table',
    });

    expect(JSON.parse(exoticRows[0].newRow ?? '')).toEqual({
      [exoticColumn]: 'quoted value',
    });
    const wideRow = JSON.parse(wideRows[0].newRow ?? '') as Record<
      string,
      unknown
    >;
    expect(Object.keys(wideRow)).toHaveLength(60);
    expect(wideRow.column40).toBeNull();
  });

  it('uninstalls only journal triggers and supports filtered reads', async () => {
    const dataSource = await createDataSource();
    await dataSource.query('CREATE TABLE events (id INTEGER PRIMARY KEY, name TEXT)');
    await driver.install(dataSource, journalOptions);
    await dataSource.query("INSERT INTO events (id, name) VALUES (1, 'journaled')");
    await driver.uninstall(dataSource, journalOptions);
    await dataSource.query("INSERT INTO events (id, name) VALUES (2, 'not journaled')");

    expect(await countJournalRows(dataSource)).toBe(1);
    await dataSource.query(
      `INSERT INTO ${quoteSqliteIdentifier(DEFAULT_JOURNAL_TABLE)} (occurredAt, tableName, action, oldRow, newRow, actor) VALUES (?, ?, ?, NULL, NULL, NULL), (?, ?, ?, NULL, NULL, NULL), (?, ?, ?, NULL, NULL, NULL)`,
      [10, 'manual', 'insert', 20, 'manual', 'update', 30, 'manual', 'delete'],
    );

    const filteredRows = await driver.read(dataSource, journalOptions, {
      tableName: 'manual',
      action: 'update',
      sinceMs: 20,
      untilMs: 30,
      limit: 1,
      offset: 0,
    });
    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0]).toMatchObject({
      tableName: 'manual',
      action: 'update',
      occurredAt: 20,
    });

    for (let index = 0; index < DEFAULT_READ_LIMIT + 1; index += 1) {
      await dataSource.query(
        `INSERT INTO ${quoteSqliteIdentifier(DEFAULT_JOURNAL_TABLE)} (occurredAt, tableName, action, oldRow, newRow, actor) VALUES (?, 'many', 'insert', NULL, NULL, NULL)`,
        [1000 + index],
      );
    }

    const defaultLimitRows = await driver.read(dataSource, journalOptions, {
      tableName: 'many',
    });
    const offsetRows = await driver.read(dataSource, journalOptions, {
      tableName: 'many',
      limit: 1,
      offset: DEFAULT_READ_LIMIT,
    });
    const journalTable = (await dataSource.query(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${quoteSqliteStringLiteral(DEFAULT_JOURNAL_TABLE)}`,
    )) as Array<{ name: string }>;

    expect(defaultLimitRows).toHaveLength(DEFAULT_READ_LIMIT);
    expect(offsetRows).toHaveLength(1);
    expect(journalTable).toEqual([{ name: DEFAULT_JOURNAL_TABLE }]);
  });

  it('releases failed installation query runners when no transaction is active', async () => {
    const queryRunner = {
      connect: jest.fn(async () => {
        throw new Error('connection failed');
      }),
      isTransactionActive: false,
      isReleased: false,
      release: jest.fn(async () => undefined),
    };
    const dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
    } as unknown as DataSource;

    await expect(driver.install(dataSource, journalOptions)).rejects.toThrow(
      'connection failed',
    );

    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('does not release already released runners', async () => {
    const releasedQueryRunner = {
      connect: jest.fn(async () => {
        throw new Error('connection failed');
      }),
      isTransactionActive: false,
      isReleased: true,
      release: jest.fn(async () => undefined),
    };
    const dataSource = {
      createQueryRunner: jest.fn(() => releasedQueryRunner),
    } as unknown as DataSource;

    await expect(driver.install(dataSource, journalOptions)).rejects.toThrow(
      'connection failed',
    );
    expect(releasedQueryRunner.release).not.toHaveBeenCalled();
  });

  it('treats a table with an unavailable SQL definition as a non-virtual table', async () => {
    const queryRunner = {
      connect: jest.fn(async () => undefined),
      startTransaction: jest.fn(async () => undefined),
      commitTransaction: jest.fn(async () => undefined),
      rollbackTransaction: jest.fn(async () => undefined),
      isTransactionActive: false,
      isReleased: false,
      release: jest.fn(async () => undefined),
      query: jest.fn(async (query: string) => {
        if (query.startsWith('SELECT name, sql')) {
          return [{ name: 'unavailable_sql', sql: null }];
        }
        if (query.startsWith('PRAGMA table_info')) {
          return [{ name: 'payload', type: 'BLOB' }];
        }
        return [];
      }),
    };
    const dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
      name: 'default',
    } as unknown as DataSource;

    await expect(driver.install(dataSource, journalOptions)).resolves.toEqual(
      expect.objectContaining({
        skippedTables: [
          { tableName: 'unavailable_sql', reason: 'blob-column' },
        ],
      }),
    );
  });
});
