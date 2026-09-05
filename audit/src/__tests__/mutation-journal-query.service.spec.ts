import { describe, expect, it, jest } from '@jest/globals';
import type { DataSource } from 'typeorm';
import { DEFAULT_JOURNAL_TABLE } from '../mutation-journal.def.js';
import type { MutationJournalRow } from '../mutation-journal.interface.js';
import type { ResolvedMutationJournalOptions } from '../mutation-journal.module.js';
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
