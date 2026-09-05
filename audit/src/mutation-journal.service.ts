import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import {
  MUTATION_JOURNAL_DRIVERS,
  MUTATION_JOURNAL_OPTIONS,
} from './mutation-journal.def.js';
import type {
  IMutationJournalDriver,
  MutationJournalDriverInstallOptions,
  MutationJournalInstallReport,
  MutationJournalTargetRef,
} from './mutation-journal.interface.js';
import type { ResolvedMutationJournalOptions } from './mutation-journal.module.js';

export interface ResolvedMutationJournalTarget {
  dataSource: DataSource;
  driver: IMutationJournalDriver;
  target: MutationJournalTargetRef;
}

interface MutationJournalModuleRef {
  get<TResult>(
    // Nest accepts class constructor tokens through the framework-level Function type.
    // eslint-disable-next-line @typescript-eslint/ban-types
    token: string | symbol | Function,
    options: { strict: boolean },
  ): TResult | undefined;
}

@Injectable()
export class MutationJournalService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MutationJournalService.name);
  private reports: MutationJournalInstallReport[] = [];

  public constructor(
    @Inject(ModuleRef)
    private readonly moduleRef: MutationJournalModuleRef,
    @Inject(MUTATION_JOURNAL_OPTIONS)
    private readonly options: ResolvedMutationJournalOptions,
    @Inject(MUTATION_JOURNAL_DRIVERS)
    private readonly drivers: IMutationJournalDriver[],
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    if (!this.options.enabled) {
      if (this.options.uninstallWhenDisabled) {
        await this.uninstall();
      }
      return;
    }
    if (this.options.installOnBootstrap !== false) {
      await this.install();
    }
  }

  public async install(): Promise<MutationJournalInstallReport[]> {
    const reports = await Promise.all(
      this.options.targets.map((target) => this.installTarget(target)),
    );

    this.reports = reports;
    return reports;
  }

  public async refresh(): Promise<MutationJournalInstallReport[]> {
    return this.install();
  }

  public async uninstall(): Promise<void> {
    await Promise.all(
      this.options.targets.map(async (target) => {
        const resolvedTarget = await this.resolveTarget(target);
        if (!resolvedTarget) {
          return;
        }

        try {
          await resolvedTarget.driver.uninstall(
            resolvedTarget.dataSource,
            this.getDriverOptions(),
          );
        } catch (error) {
          this.logger.warn(
            `Unable to uninstall mutation journal for ${this.getTargetName(
              target,
            )}: ${this.getErrorMessage(error)}`,
          );
        }
      }),
    );
  }

  public getReports(): MutationJournalInstallReport[] {
    return [...this.reports];
  }

  public getTargets(): MutationJournalTargetRef[] {
    return this.options.targets;
  }

  public getDriverOptions(): MutationJournalDriverInstallOptions {
    return {
      journalTableName: this.options.journalTableName,
      excludedTables: this.options.excludedTables,
      actorSetting: this.options.actorSetting,
    };
  }

  public async resolveTarget(
    target: MutationJournalTargetRef = {},
  ): Promise<ResolvedMutationJournalTarget | undefined> {
    const token = target.token ?? getDataSourceToken(target.dataSourceName);
    let dataSource: DataSource | undefined;

    try {
      dataSource = this.moduleRef.get<DataSource>(token, { strict: false });
      if (!dataSource) {
        this.logger.warn(
          `Unable to resolve mutation journal target ${this.getTargetName(
            target,
          )}.`,
        );
        return undefined;
      }

      const resolvedDataSource = dataSource;
      const driver = this.drivers.find((candidate) =>
        candidate.supports(resolvedDataSource),
      );
      if (!driver) {
        this.logger.warn(
          `No mutation journal driver supports ${this.getTargetName(target)}.`,
        );
        return undefined;
      }

      return { dataSource: resolvedDataSource, driver, target };
    } catch (error) {
      this.logger.warn(
        `Unable to resolve mutation journal target ${this.getTargetName(
          target,
        )}: ${this.getErrorMessage(error)}`,
      );
      return undefined;
    }
  }

  private async installTarget(
    target: MutationJournalTargetRef,
  ): Promise<MutationJournalInstallReport> {
    const resolvedTarget = await this.resolveTarget(target);
    if (!resolvedTarget) {
      return {
        dataSourceName: this.getTargetName(target),
        engine: 'unknown',
        journaledTables: [],
        skippedTables: [],
      };
    }

    try {
      const report = await resolvedTarget.driver.install(
        resolvedTarget.dataSource,
        this.getDriverOptions(),
      );
      this.logger.log(
        `Installed mutation journal for ${this.getTargetName(target)} (${
          report.journaledTables.length
        } tables).`,
      );
      return report;
    } catch (error) {
      this.logger.warn(
        `Unable to install mutation journal for ${this.getTargetName(
          target,
        )}: ${this.getErrorMessage(error)}`,
      );
      return {
        dataSourceName: this.getTargetName(target),
        engine: resolvedTarget.driver.engine,
        journaledTables: [],
        skippedTables: [],
      };
    }
  }

  private getTargetName(target: MutationJournalTargetRef): string {
    return target.dataSourceName ?? 'default';
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
