import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { DataSource } from 'typeorm';
import { DEFAULT_JOURNAL_TABLE } from '../mutation-journal.def.js';
import type { MutationJournalRow } from '../mutation-journal.interface.js';
import type { ResolvedMutationJournalOptions } from '../mutation-journal.module.js';
import { MutationJournalCleanupService } from '../mutation-journal-cleanup.service.js';
import {
  MutationJournalQueryService,
  parseMutationJournalRow,
} from '../mutation-journal-query.service.js';
import type {
  ResolvedMutationJournalTarget,
} from '../mutation-journal.service.js';
import type { MutationJournalService } from '../mutation-journal.service.js';

const options: ResolvedMutationJournalOptions = {
  enabled: true,
  targets: [{}, { dataSourceName: 'secondary' }, { dataSourceName: 'missing' }],
  excludedTables: [],
  journalTableName: DEFAULT_JOURNAL_TABLE,
  retentionDays: 2,
  cleanupIntervalMs: 100,
};

function createJournalService(
  overrides: Partial<MutationJournalService> = {},
): MutationJournalService {
  return {
    getTargets: jest.fn(() => options.targets),
    getDriverOptions: jest.fn(() => ({
      journalTableName: DEFAULT_JOURNAL_TABLE,
      excludedTables: [],
    })),
    resolveTarget: jest.fn(),
    ...overrides,
  } as unknown as MutationJournalService;
}

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('MutationJournalCleanupService', () => {
  it('runs cleanup per resolved target and continues after errors', async () => {
    const dataSource = {} as DataSource;
    const successfulTarget: ResolvedMutationJournalTarget = {
      dataSource,
      target: {},
      driver: {
        engine: 'test',
        supports: jest.fn(),
        install: jest.fn(),
        uninstall: jest.fn(),
        cleanup: jest.fn(async () => 3),
        read: jest.fn(),
      },
    };
    const failingTarget: ResolvedMutationJournalTarget = {
      ...successfulTarget,
      target: { dataSourceName: 'secondary' },
      driver: {
        ...successfulTarget.driver,
        cleanup: jest.fn(async () => {
          throw new Error('cleanup failed');
        }),
      },
    };
    const stringFailingTarget: ResolvedMutationJournalTarget = {
      ...successfulTarget,
      target: { dataSourceName: 'string-failure' },
      driver: {
        ...successfulTarget.driver,
        cleanup: jest.fn(async () => {
          throw 'string cleanup failed';
        }),
      },
    };
    const journalService = createJournalService({
      getTargets: jest.fn(() => [
        ...options.targets,
        { dataSourceName: 'string-failure' },
      ]),
      resolveTarget: jest
        .fn()
        .mockResolvedValueOnce(successfulTarget)
        .mockResolvedValueOnce(failingTarget)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(stringFailingTarget),
    });
    const now = 9_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const cleanupService = new MutationJournalCleanupService(
      journalService,
      options,
    );

    await expect(cleanupService.runOnce()).resolves.toBe(3);

    expect(successfulTarget.driver.cleanup).toHaveBeenCalledWith(
      dataSource,
      expect.objectContaining({ journalTableName: DEFAULT_JOURNAL_TABLE }),
      now - 2 * 86_400_000,
    );
    expect(failingTarget.driver.cleanup).toHaveBeenCalledTimes(1);
    expect(stringFailingTarget.driver.cleanup).toHaveBeenCalledTimes(1);
  });

  it('schedules an unrefd cleanup interval and clears it on destruction', async () => {
    jest.useFakeTimers();
    const timer = { unref: jest.fn() } as unknown as NodeJS.Timeout;
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockReturnValue(timer);
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const journalService = createJournalService();
    const cleanupService = new MutationJournalCleanupService(
      journalService,
      options,
    );
    const runOnce = jest.spyOn(cleanupService, 'runOnce').mockResolvedValue(0);

    cleanupService.onApplicationBootstrap();
    const callback = setIntervalSpy.mock.calls[0][0] as () => void;
    callback();
    await Promise.resolve();
    cleanupService.onModuleDestroy();

    expect(timer.unref).toHaveBeenCalledTimes(1);
    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).toHaveBeenCalledWith(timer);
  });

  it('does not schedule or clean while disabled or without retention', async () => {
    const journalService = createJournalService();
    const disabledService = new MutationJournalCleanupService(journalService, {
      ...options,
      enabled: false,
    });
    const noRetentionService = new MutationJournalCleanupService(journalService, {
      ...options,
      retentionDays: undefined,
    });

    disabledService.onApplicationBootstrap();
    noRetentionService.onApplicationBootstrap();

    await expect(disabledService.runOnce()).resolves.toBe(0);
    await expect(noRetentionService.runOnce()).resolves.toBe(0);
    expect(journalService.getTargets).not.toHaveBeenCalled();
    disabledService.onModuleDestroy();
  });

  it('uses the default target name when cleanup fails without a data source name', async () => {
    const failingTarget: ResolvedMutationJournalTarget = {
      dataSource: {} as DataSource,
      target: {},
      driver: {
        engine: 'test',
        supports: jest.fn(),
        install: jest.fn(),
        uninstall: jest.fn(),
        cleanup: jest.fn(async () => {
          throw new Error('default cleanup failed');
        }),
        read: jest.fn(),
      },
    };
    const journalService = createJournalService({
      getTargets: jest.fn(() => [{}]),
      resolveTarget: jest.fn(async () => failingTarget),
    });
    const cleanupService = new MutationJournalCleanupService(
      journalService,
      options,
    );

    await expect(cleanupService.runOnce()).resolves.toBe(0);
  });

  it('contains target-resolution errors and continues with later targets', async () => {
    const dataSource = {} as DataSource;
    const resolvedTarget: ResolvedMutationJournalTarget = {
      dataSource,
      target: { dataSourceName: 'secondary' },
      driver: {
        engine: 'test',
        supports: jest.fn(),
        install: jest.fn(),
        uninstall: jest.fn(),
        cleanup: jest.fn(async () => 2),
        read: jest.fn(),
      },
    };
    const journalService = createJournalService({
      getTargets: jest.fn(() => [{}, { dataSourceName: 'secondary' }]),
      resolveTarget: jest
        .fn()
        .mockRejectedValueOnce(new Error('resolution failed'))
        .mockResolvedValueOnce(resolvedTarget),
    });
    const cleanupService = new MutationJournalCleanupService(
      journalService,
      options,
    );

    await expect(cleanupService.runOnce()).resolves.toBe(2);
    expect(resolvedTarget.driver.cleanup).toHaveBeenCalledTimes(1);
  });
});

describe('MutationJournalQueryService', () => {
  it('delegates reads through a resolved target and returns no rows when absent', async () => {
    const rows: MutationJournalRow[] = [
      {
        id: 1,
        occurredAt: 1,
        tableName: 'items',
        action: 'insert',
        oldRow: null,
        newRow: '{"id":1}',
        actor: null,
      },
    ];
    const dataSource = {} as DataSource;
    const target: ResolvedMutationJournalTarget = {
      dataSource,
      target: {},
      driver: {
        engine: 'test',
        supports: jest.fn(),
        install: jest.fn(),
        uninstall: jest.fn(),
        cleanup: jest.fn(),
        read: jest.fn(async () => rows),
      },
    };
    const journalService = createJournalService({
      resolveTarget: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(target),
    });
    const queryService = new MutationJournalQueryService(journalService);

    await expect(queryService.find(undefined, {})).resolves.toEqual([]);
    await expect(queryService.find({}, { tableName: 'items' })).resolves.toEqual(
      rows,
    );

    expect(target.driver.read).toHaveBeenCalledWith(
      dataSource,
      expect.objectContaining({ journalTableName: DEFAULT_JOURNAL_TABLE }),
      { tableName: 'items' },
    );
  });

  it('parses JSON journal payloads without removing the raw fields', () => {
    const parsed = parseMutationJournalRow({
      id: 1,
      occurredAt: 2,
      tableName: 'items',
      action: 'update',
      oldRow: '{"name":"old"}',
      newRow: null,
      actor: null,
    });

    expect(parsed).toEqual({
      id: 1,
      occurredAt: 2,
      tableName: 'items',
      action: 'update',
      oldRow: '{"name":"old"}',
      newRow: null,
      actor: null,
      old: { name: 'old' },
      new: null,
    });

    expect(
      parseMutationJournalRow({
        id: 2,
        occurredAt: 3,
        tableName: 'items',
        action: 'insert',
        oldRow: null,
        newRow: '{"name":"new"}',
        actor: null,
      }),
    ).toMatchObject({ old: null, new: { name: 'new' } });
  });
});
