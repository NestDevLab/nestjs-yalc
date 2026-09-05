import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BUILTIN_EXCLUDED_TABLES,
  DEFAULT_JOURNAL_TABLE,
  MUTATION_JOURNAL_OPTIONS,
} from '../mutation-journal.def.js';
import type {
  IMutationJournalDriver,
  MutationJournalInstallReport,
} from '../mutation-journal.interface.js';
import { MutationJournalModule } from '../mutation-journal.module.js';
import { MutationJournalService } from '../mutation-journal.service.js';

let testingModules: TestingModule[] = [];
let standaloneDataSources: DataSource[] = [];

afterEach(async () => {
  await Promise.all(testingModules.map((moduleRef) => moduleRef.close()));
  testingModules = [];
  await Promise.all(
    standaloneDataSources
      .filter((dataSource) => dataSource.isInitialized)
      .map((dataSource) => dataSource.destroy()),
  );
  standaloneDataSources = [];
});

describe('MutationJournalModule', () => {
  it('normalizes options', () => {
    const dynamicModule = MutationJournalModule.forRoot({
      enabled: true,
      excludedTables: ['custom_table', 'migrations'],
    });
    const optionsProvider = dynamicModule.providers?.find(
      (provider) =>
        typeof provider === 'object' &&
        provider !== null &&
        'provide' in provider &&
        provider.provide === MUTATION_JOURNAL_OPTIONS,
    ) as { useValue: { excludedTables: string[]; journalTableName: string; targets: unknown[] } };

    expect(optionsProvider.useValue.journalTableName).toBe(DEFAULT_JOURNAL_TABLE);
    expect(optionsProvider.useValue.targets).toEqual([{}]);
    expect(optionsProvider.useValue.excludedTables).toEqual(
      expect.arrayContaining([...BUILTIN_EXCLUDED_TABLES, 'custom_table']),
    );
    expect(optionsProvider.useValue.excludedTables).toHaveLength(3);
  });

  it('installs journals for default and named TypeORM data sources', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({ type: 'sqlite', database: ':memory:' }),
        TypeOrmModule.forRoot({
          name: 'secondary',
          type: 'sqlite',
          database: ':memory:',
        }),
        MutationJournalModule.forRoot({
          enabled: true,
          targets: [{}, { dataSourceName: 'secondary' }],
        }),
      ],
    }).compile();
    testingModules.push(moduleRef);
    const defaultDataSource = moduleRef.get<DataSource>(getDataSourceToken());
    const secondaryDataSource = moduleRef.get<DataSource>(
      getDataSourceToken('secondary'),
    );

    await defaultDataSource.query('CREATE TABLE default_items (id INTEGER PRIMARY KEY)');
    await secondaryDataSource.query(
      'CREATE TABLE secondary_items (id INTEGER PRIMARY KEY)',
    );
    await moduleRef.init();

    const service = moduleRef.get(MutationJournalService);
    const reports = service.getReports();
    const defaultJournal = await defaultDataSource.query(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${DEFAULT_JOURNAL_TABLE}'`,
    );
    const secondaryJournal = await secondaryDataSource.query(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${DEFAULT_JOURNAL_TABLE}'`,
    );

    expect(reports).toHaveLength(2);
    expect(reports[0].journaledTables).toContain('default_items');
    expect(reports[1].journaledTables).toContain('secondary_items');
    expect(defaultJournal).toEqual([{ name: DEFAULT_JOURNAL_TABLE }]);
    expect(secondaryJournal).toEqual([{ name: DEFAULT_JOURNAL_TABLE }]);
  });

  it('supports forRootAsync and manual installation after bootstrap for named data sources', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({ type: 'sqlite', database: ':memory:' }),
        TypeOrmModule.forRoot({
          name: 'secondary',
          type: 'sqlite',
          database: ':memory:',
        }),
        MutationJournalModule.forRootAsync({
          useFactory: async () => ({
            enabled: true,
            installOnBootstrap: false,
            targets: [{}, { dataSourceName: 'secondary' }],
          }),
        }),
      ],
    }).compile();
    testingModules.push(moduleRef);
    const dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    const secondaryDataSource = moduleRef.get<DataSource>(
      getDataSourceToken('secondary'),
    );

    await dataSource.query('CREATE TABLE deferred_items (id INTEGER PRIMARY KEY)');
    await secondaryDataSource.query(
      'CREATE TABLE deferred_secondary_items (id INTEGER PRIMARY KEY)',
    );
    await moduleRef.init();
    const beforeInstall = await dataSource.query(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${DEFAULT_JOURNAL_TABLE}'`,
    );
    const beforeSecondaryInstall = await secondaryDataSource.query(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${DEFAULT_JOURNAL_TABLE}'`,
    );
    const service = moduleRef.get(MutationJournalService);
    const reports = await service.install();

    expect(beforeInstall).toEqual([]);
    expect(beforeSecondaryInstall).toEqual([]);
    expect(reports).toHaveLength(2);
    expect(reports[0].journaledTables).toContain('deferred_items');
    expect(reports[1].journaledTables).toContain('deferred_secondary_items');
  });

  it('supports a custom data-source token and refreshes newly created tables', async () => {
    const dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
    await dataSource.initialize();
    standaloneDataSources.push(dataSource);
    await dataSource.query('CREATE TABLE initial_items (id INTEGER PRIMARY KEY)');
    const token = Symbol('custom-data-source');
    const moduleRef = await Test.createTestingModule({
      imports: [
        MutationJournalModule.forRoot({ enabled: true, targets: [{ token }] }),
      ],
      providers: [{ provide: token, useValue: dataSource }],
    }).compile();
    testingModules.push(moduleRef);

    await moduleRef.init();
    await dataSource.query('CREATE TABLE later_items (id INTEGER PRIMARY KEY)');
    const reports = await moduleRef.get(MutationJournalService).refresh();

    expect(reports[0].journaledTables).toEqual(
      expect.arrayContaining(['initial_items', 'later_items']),
    );
  });

  it('does not touch disabled data sources and removes pre-seeded triggers when requested', async () => {
    const disabledModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({ type: 'sqlite', database: ':memory:' }),
        MutationJournalModule.forRoot({ enabled: false }),
      ],
    }).compile();
    testingModules.push(disabledModule);
    const disabledDataSource = disabledModule.get<DataSource>(getDataSourceToken());

    await disabledModule.init();
    await expect(
      disabledDataSource.query(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${DEFAULT_JOURNAL_TABLE}'`,
      ),
    ).resolves.toEqual([]);

    const dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
    await dataSource.initialize();
    standaloneDataSources.push(dataSource);
    await dataSource.query('CREATE TABLE items (id INTEGER PRIMARY KEY)');
    await dataSource.query(
      'CREATE TRIGGER "_mj_ai__items" AFTER INSERT ON items BEGIN SELECT 1; END',
    );
    const token = Symbol('pre-seeded-data-source');
    const uninstallModule = await Test.createTestingModule({
      imports: [
        MutationJournalModule.forRoot({
          enabled: false,
          uninstallWhenDisabled: true,
          targets: [{ token }],
        }),
      ],
      providers: [{ provide: token, useValue: dataSource }],
    }).compile();
    testingModules.push(uninstallModule);

    await uninstallModule.init();
    await expect(
      dataSource.query(
        "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = '_mj_ai__items'",
      ),
    ).resolves.toEqual([]);
  });

  it('reports unresolvable and unsupported targets without failing bootstrap', async () => {
    const missingToken = Symbol('missing-data-source');
    const unsupportedToken = Symbol('unsupported-data-source');
    const moduleRef = await Test.createTestingModule({
      imports: [
        MutationJournalModule.forRoot({
          enabled: true,
          targets: [{ token: missingToken }, { token: unsupportedToken }],
        }),
      ],
      providers: [
        {
          provide: unsupportedToken,
          useValue: { name: 'unsupported', options: { type: 'postgres' } },
        },
      ],
    }).compile();
    testingModules.push(moduleRef);

    await moduleRef.init();

    expect(moduleRef.get(MutationJournalService).getReports()).toEqual([
      expect.objectContaining({ engine: 'unknown', journaledTables: [] }),
      expect.objectContaining({ engine: 'unknown', journaledTables: [] }),
    ]);
  });

  it('uses configured drivers instead of the default SQLite driver', async () => {
    const dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
    await dataSource.initialize();
    standaloneDataSources.push(dataSource);
    const token = Symbol('custom-driver-data-source');
    const report: MutationJournalInstallReport = {
      dataSourceName: 'custom',
      engine: 'custom',
      journaledTables: [],
      skippedTables: [],
    };
    const customDriver: IMutationJournalDriver = {
      engine: 'custom',
      supports: jest.fn(() => true),
      install: jest.fn(async () => report),
      uninstall: jest.fn(async () => undefined),
      read: jest.fn(async () => []),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [
        MutationJournalModule.forRoot({
          enabled: true,
          targets: [{ token }],
          drivers: [customDriver],
        }),
      ],
      providers: [{ provide: token, useValue: dataSource }],
    }).compile();
    testingModules.push(moduleRef);

    await moduleRef.init();

    expect(customDriver.install).toHaveBeenCalledTimes(1);
    expect(moduleRef.get(MutationJournalService).getReports()).toEqual([report]);
  });
});
