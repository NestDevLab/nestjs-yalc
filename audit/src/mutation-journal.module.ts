import {
  DynamicModule,
  FactoryProvider,
  Module,
  ModuleMetadata,
  Provider,
} from '@nestjs/common';
import {
  BUILTIN_EXCLUDED_TABLES,
  DEFAULT_JOURNAL_TABLE,
  MUTATION_JOURNAL_DRIVERS,
  MUTATION_JOURNAL_OPTIONS,
} from './mutation-journal.def.js';
import type {
  MutationJournalOptions,
  MutationJournalTargetRef,
} from './mutation-journal.interface.js';
import { MutationJournalQueryService } from './mutation-journal-query.service.js';
import { MutationJournalService } from './mutation-journal.service.js';
import { SqliteTriggerJournalDriver } from './sqlite/sqlite-trigger-journal.driver.js';

export interface ResolvedMutationJournalOptions extends MutationJournalOptions {
  targets: MutationJournalTargetRef[];
  excludedTables: string[];
  journalTableName: string;
}

export interface MutationJournalModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: FactoryProvider['inject'];
  useFactory: (
    ...args: unknown[]
  ) => MutationJournalOptions | Promise<MutationJournalOptions>;
}

@Module({})
export class MutationJournalModule {
  public static forRoot(options: MutationJournalOptions): DynamicModule {
    return this.createDynamicModule({
      provide: MUTATION_JOURNAL_OPTIONS,
      useValue: this.normalizeOptions(options),
    });
  }

  public static forRootAsync(
    options: MutationJournalModuleAsyncOptions,
  ): DynamicModule {
    return this.createDynamicModule(
      {
        provide: MUTATION_JOURNAL_OPTIONS,
        useFactory: async (...args: unknown[]) =>
          this.normalizeOptions(await options.useFactory(...args)),
        inject: options.inject,
      },
      options.imports,
    );
  }

  private static createDynamicModule(
    optionsProvider: Provider,
    imports: ModuleMetadata['imports'] = [],
  ): DynamicModule {
    const providers: Provider[] = [
      optionsProvider,
      {
        provide: MUTATION_JOURNAL_DRIVERS,
        useFactory: (options: ResolvedMutationJournalOptions) =>
          options.drivers ?? [new SqliteTriggerJournalDriver()],
        inject: [MUTATION_JOURNAL_OPTIONS],
      },
      MutationJournalService,
      MutationJournalQueryService,
    ];

    return {
      module: MutationJournalModule,
      imports,
      providers,
      exports: [
        MUTATION_JOURNAL_OPTIONS,
        MUTATION_JOURNAL_DRIVERS,
        MutationJournalService,
        MutationJournalQueryService,
      ],
    };
  }

  private static normalizeOptions(
    options: MutationJournalOptions,
  ): ResolvedMutationJournalOptions {
    return {
      ...options,
      targets: options.targets ?? [{}],
      excludedTables: [
        ...new Set([
          ...BUILTIN_EXCLUDED_TABLES,
          ...(options.excludedTables ?? []),
        ]),
      ],
      journalTableName: options.journalTableName ?? DEFAULT_JOURNAL_TABLE,
    };
  }
}
