import type { Type } from '@nestjs/common';
import type { DataSource } from 'typeorm';

export type MutationJournalAction = 'insert' | 'update' | 'delete';

export interface MutationJournalRow {
  id: number;
  occurredAt: number;
  tableName: string;
  action: MutationJournalAction;
  oldRow: string | null;
  newRow: string | null;
  actor: string | null;
}

export type MutationJournalSkipReason =
  | 'excluded'
  | 'blob-column'
  | 'virtual-table'
  | 'too-many-columns';

export interface MutationJournalInstallReport {
  dataSourceName: string;
  engine: string;
  journaledTables: string[];
  skippedTables: Array<{
    tableName: string;
    reason: MutationJournalSkipReason;
    detail?: string;
  }>;
}

export interface MutationJournalReadFilter {
  tableName?: string;
  action?: MutationJournalAction;
  sinceMs?: number;
  untilMs?: number;
  limit?: number;
  offset?: number;
}

export interface MutationJournalDriverInstallOptions {
  journalTableName: string;
  excludedTables: string[];
  actorSetting?: string;
}

export interface IMutationJournalDriver {
  readonly engine: string;
  supports(dataSource: DataSource): boolean;
  install(
    dataSource: DataSource,
    options: MutationJournalDriverInstallOptions,
  ): Promise<MutationJournalInstallReport>;
  uninstall(
    dataSource: DataSource,
    options: MutationJournalDriverInstallOptions,
  ): Promise<void>;
  read(
    dataSource: DataSource,
    options: MutationJournalDriverInstallOptions,
    filter: MutationJournalReadFilter,
  ): Promise<MutationJournalRow[]>;
}

export interface MutationJournalTargetRef {
  dataSourceName?: string;
  token?: string | symbol | Type<unknown>;
}

export interface MutationJournalOptions {
  enabled: boolean;
  targets?: MutationJournalTargetRef[];
  excludedTables?: string[];
  installOnBootstrap?: boolean;
  uninstallWhenDisabled?: boolean;
  journalTableName?: string;
  drivers?: IMutationJournalDriver[];
  actorSetting?: string;
}
