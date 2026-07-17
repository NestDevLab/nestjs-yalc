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

const MILLISECONDS_PER_DAY = 86_400_000;

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
    private readonly mutationJournalService: MutationJournalCleanupPort,
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
      void this.runOnce();
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

    const olderThanMs =
      Date.now() - this.options.retentionDays * MILLISECONDS_PER_DAY;
    let deletedRows = 0;

    for (const target of this.mutationJournalService.getTargets()) {
      try {
        const resolvedTarget =
          await this.mutationJournalService.resolveTarget(target);
        if (!resolvedTarget) {
          continue;
        }

        deletedRows += await resolvedTarget.driver.cleanup(
          resolvedTarget.dataSource,
          this.mutationJournalService.getDriverOptions(),
          olderThanMs,
        );
      } catch (error) {
        this.logger.warn(
          `Unable to clean mutation journal for ${target.dataSourceName ?? 'default'}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return deletedRows;
  }
}
