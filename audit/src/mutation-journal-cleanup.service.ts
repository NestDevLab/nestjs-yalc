import {
  Inject,
  Injectable,
  Logger,
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
  private readonly logger = new Logger(MutationJournalCleanupService.name);
  private timer?: NodeJS.Timeout;

  public constructor(
    @Inject(MutationJournalService)
    _mutationJournalService: MutationJournalCleanupPort,
    @Inject(MUTATION_JOURNAL_OPTIONS)
    private readonly options: ResolvedMutationJournalOptions,
  ) {}

  public onApplicationBootstrap(): void {
    if (
      !this.options.enabled ||
      this.options.retentionDays === undefined ||
      this.options.cleanupIntervalMs === undefined
    ) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runOnce().catch((error: unknown) => {
        this.logger.error(
          error instanceof Error ? error.message : String(error),
        );
      });
    }, this.options.cleanupIntervalMs);
    this.timer.unref();
  }

  public onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  public async runOnce(): Promise<number> {
    if (!this.options.enabled || this.options.retentionDays === undefined) {
      return 0;
    }
    throw new Error(MUTATION_JOURNAL_CLEANUP_DISABLED_MESSAGE);
  }
}
