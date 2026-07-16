import { Inject, Injectable } from '@nestjs/common';
import type {
  MutationJournalDriverInstallOptions,
  MutationJournalReadFilter,
  MutationJournalRow,
  MutationJournalTargetRef,
} from './mutation-journal.interface.js';
import {
  MutationJournalService,
  type ResolvedMutationJournalTarget,
} from './mutation-journal.service.js';

interface MutationJournalQueryPort {
  getDriverOptions(): MutationJournalDriverInstallOptions;
  resolveTarget(
    target: MutationJournalTargetRef | undefined,
  ): Promise<ResolvedMutationJournalTarget | undefined>;
}

export interface ParsedMutationJournalRow extends MutationJournalRow {
  old: unknown | null;
  new: unknown | null;
}

export function parseMutationJournalRow(
  row: MutationJournalRow,
): ParsedMutationJournalRow {
  return {
    ...row,
    old: row.oldRow === null ? null : JSON.parse(row.oldRow),
    new: row.newRow === null ? null : JSON.parse(row.newRow),
  };
}

@Injectable()
export class MutationJournalQueryService {
  public constructor(
    @Inject(MutationJournalService)
    private readonly mutationJournalService: MutationJournalQueryPort,
  ) {}

  public async find(
    target: MutationJournalTargetRef | undefined,
    filter: MutationJournalReadFilter,
  ): Promise<MutationJournalRow[]> {
    const resolvedTarget =
      await this.mutationJournalService.resolveTarget(target);
    if (!resolvedTarget) {
      return [];
    }

    return resolvedTarget.driver.read(
      resolvedTarget.dataSource,
      this.mutationJournalService.getDriverOptions(),
      filter,
    );
  }
}
