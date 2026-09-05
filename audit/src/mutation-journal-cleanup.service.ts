import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { MUTATION_JOURNAL_OPTIONS } from './mutation-journal.def.js';
import type {
  MutationJournalDriverInstallOptions,
  MutationJournalTargetRef,
} from './mutation-journal.interface.js';
import type { ResolvedMutationJournalOptions } from './mutation-journal.module.js';
import {
  MutationJournalService,
  type ResolvedMutationJournalTarget,
} from './mutation-journal.service.js';

export const MUTATION_JOURNAL_CLEANUP_DISABLED_MESSAGE =
  "In-process mutation-journal cleanup is disabled; use the host application's governed retention command.";

interface MutationJournalCleanupPort {
  getDriverOptions(): MutationJournalDriverInstallOptions;
  getTargets(): MutationJournalTargetRef[];
  resolveTarget(
    target: MutationJournalTargetRef,
  ): Promise<ResolvedMutationJournalTarget | undefined>;
}

@Injectable()
export class MutationJournalCleanupService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  public constructor(
    @Inject(MutationJournalService)
    _mutationJournalService: MutationJournalCleanupPort,
    @Inject(MUTATION_JOURNAL_OPTIONS)
    private readonly options: ResolvedMutationJournalOptions,
  ) {}

  public onApplicationBootstrap(): void {
    // In-process retention is disabled. Legacy cleanupIntervalMs is ignored so
    // an unsupported cleanup cannot run repeatedly or spam application logs.
  }

  public onModuleDestroy(): void {
    // No in-process retention resources are allocated.
  }

  public async runOnce(): Promise<number> {
    if (!this.options.enabled || this.options.retentionDays === undefined) {
      return 0;
    }
    throw new Error(MUTATION_JOURNAL_CLEANUP_DISABLED_MESSAGE);
  }
}
