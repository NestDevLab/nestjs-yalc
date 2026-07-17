import { describe, expect, it, jest } from '@jest/globals';
import type { ModuleRef } from '@nestjs/core';
import type { DataSource } from 'typeorm';
import { DEFAULT_JOURNAL_TABLE } from '../mutation-journal.def.js';
import type {
  IMutationJournalDriver,
  MutationJournalInstallReport,
} from '../mutation-journal.interface.js';
import type { ResolvedMutationJournalOptions } from '../mutation-journal.module.js';
import { MutationJournalService } from '../mutation-journal.service.js';

const report: MutationJournalInstallReport = {
  dataSourceName: 'default',
  engine: 'test',
  journaledTables: ['items'],
  skippedTables: [],
};

function createOptions(
  overrides: Partial<ResolvedMutationJournalOptions> = {},
): ResolvedMutationJournalOptions {
  return {
    enabled: true,
    targets: [{}],
    excludedTables: ['migrations'],
    journalTableName: DEFAULT_JOURNAL_TABLE,
    ...overrides,
  };
}

function createDriver(
  overrides: Partial<IMutationJournalDriver> = {},
): IMutationJournalDriver {
  return {
    engine: 'test',
    supports: jest.fn(() => true),
    install: jest.fn(async () => report),
    uninstall: jest.fn(async () => undefined),
    cleanup: jest.fn(async () => 0),
    read: jest.fn(async () => []),
    ...overrides,
  };
}

describe('MutationJournalService', () => {
  it('installs at bootstrap, refreshes, and exposes reports and driver options', async () => {
    const dataSource = {} as DataSource;
    const moduleRef = { get: jest.fn(() => dataSource) } as unknown as ModuleRef;
    const driver = createDriver();
    const service = new MutationJournalService(
      moduleRef,
      createOptions({ actorSetting: 'actor' }),
      [driver],
    );

    await service.onApplicationBootstrap();
    const refreshedReports = await service.refresh();

    expect(driver.install).toHaveBeenCalledTimes(2);
    expect(service.getReports()).toEqual([report]);
    expect(refreshedReports).toEqual([report]);
    expect(service.getTargets()).toEqual([{}]);
    expect(service.getDriverOptions()).toEqual({
      journalTableName: DEFAULT_JOURNAL_TABLE,
      excludedTables: ['migrations'],
      actorSetting: 'actor',
    });
  });

  it('does not touch targets while disabled unless uninstall is requested', async () => {
    const dataSource = {} as DataSource;
    const noTouchModuleRef = { get: jest.fn() } as unknown as ModuleRef;
    const noTouchDriver = createDriver();
    const disabledService = new MutationJournalService(
      noTouchModuleRef,
      createOptions({ enabled: false }),
      [noTouchDriver],
    );

    await disabledService.onApplicationBootstrap();

    expect(noTouchModuleRef.get).not.toHaveBeenCalled();
    expect(noTouchDriver.uninstall).not.toHaveBeenCalled();

    const uninstallModuleRef = {
      get: jest.fn(() => dataSource),
    } as unknown as ModuleRef;
    const uninstallDriver = createDriver();
    const uninstallService = new MutationJournalService(
      uninstallModuleRef,
      createOptions({ enabled: false, uninstallWhenDisabled: true }),
      [uninstallDriver],
    );

    await uninstallService.onApplicationBootstrap();

    expect(uninstallDriver.uninstall).toHaveBeenCalledWith(
      dataSource,
      expect.objectContaining({ journalTableName: DEFAULT_JOURNAL_TABLE }),
    );
  });

  it('skips unresolved, unsupported, and failed targets without throwing', async () => {
    const unresolvedModuleRef = {
      get: jest.fn(() => {
        throw new Error('missing target');
      }),
    } as unknown as ModuleRef;
    const unresolvedService = new MutationJournalService(
      unresolvedModuleRef,
      createOptions(),
      [createDriver()],
    );
    const unsupportedService = new MutationJournalService(
      { get: jest.fn(() => ({})) } as unknown as ModuleRef,
      createOptions(),
      [createDriver({ supports: jest.fn(() => false) })],
    );
    const failingService = new MutationJournalService(
      { get: jest.fn(() => ({})) } as unknown as ModuleRef,
      createOptions(),
      [
        createDriver({
          install: jest.fn(async () => {
            throw new Error('install failed');
          }),
        }),
      ],
    );

    await expect(unresolvedService.install()).resolves.toEqual([
      expect.objectContaining({ engine: 'unknown', journaledTables: [] }),
    ]);
    await expect(unsupportedService.install()).resolves.toEqual([
      expect.objectContaining({ engine: 'unknown', journaledTables: [] }),
    ]);
    await expect(failingService.install()).resolves.toEqual([
      expect.objectContaining({ engine: 'test', journaledTables: [] }),
    ]);
  });

  it('resolves custom targets and suppresses uninstall failures', async () => {
    const dataSource = {} as DataSource;
    const token = Symbol('custom-target');
    const driver = createDriver({
      uninstall: jest.fn(async () => {
        throw new Error('uninstall failed');
      }),
    });
    const moduleRef = { get: jest.fn(() => dataSource) } as unknown as ModuleRef;
    const service = new MutationJournalService(
      moduleRef,
      createOptions({ targets: [{ token }] }),
      [driver],
    );

    const resolvedTarget = await service.resolveTarget({ token });
    await expect(service.uninstall()).resolves.toBeUndefined();

    expect(resolvedTarget).toEqual(
      expect.objectContaining({ dataSource, driver, target: { token } }),
    );
    expect(moduleRef.get).toHaveBeenCalledWith(token, { strict: false });
    expect(driver.uninstall).toHaveBeenCalledTimes(1);
  });

  it('handles absent targets and non-Error resolution failures', async () => {
    const absentService = new MutationJournalService(
      { get: jest.fn(() => undefined) } as unknown as ModuleRef,
      createOptions(),
      [createDriver()],
    );
    const failingService = new MutationJournalService(
      {
        get: jest.fn(() => {
          throw 'missing target';
        }),
      } as unknown as ModuleRef,
      createOptions(),
      [createDriver()],
    );

    await expect(absentService.resolveTarget()).resolves.toBeUndefined();
    await expect(absentService.uninstall()).resolves.toBeUndefined();
    await expect(failingService.resolveTarget()).resolves.toBeUndefined();
  });

  it('contains driver support-check failures', async () => {
    const service = new MutationJournalService(
      { get: jest.fn(() => ({})) } as unknown as ModuleRef,
      createOptions(),
      [
        createDriver({
          supports: jest.fn(() => {
            throw new Error('support check failed');
          }),
        }),
      ],
    );

    await expect(service.install()).resolves.toEqual([
      expect.objectContaining({ engine: 'unknown', journaledTables: [] }),
    ]);
  });
});
