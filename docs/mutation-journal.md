---
title: Mutation journal
description: Record SQLite database mutations with transactionally coupled triggers.
permalink: /mutation-journal
---

# Mutation journal

`@nestjs-yalc/audit` records row-level inserts, updates, and deletes in a
journal table owned by the database. The initial driver supports SQLite.

## Why database triggers

An ORM subscriber does not reliably see direct SQL, query-builder operations
that bypass entity hooks, administrative scripts, or another process using the
same database. The mutation journal uses database triggers so journal inserts
share the source mutation transaction and roll back with it.

## Quick start

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MutationJournalModule } from '@nestjs-yalc/audit';

@Module({
  imports: [
    TypeOrmModule.forRoot({ type: 'sqlite', database: 'app.sqlite' }),
    MutationJournalModule.forRoot({ enabled: true }),
  ],
})
export class AppModule {}
```

The module targets the default TypeORM data source, creates the
`_mutation_journal` table, and installs SQLite triggers at application
bootstrap. Reports are available from `MutationJournalService.getReports()`.

## Configuration

| Option | Default | Purpose |
| --- | --- | --- |
| `enabled` | Required | Enables trigger installation and journal reads. |
| `targets` | `[{}]` | Selects default, named, or token-provided data sources. |
| `excludedTables` | `[]` | Adds application tables that must not receive triggers. |
| `retentionDays` | None | Legacy option; it never deletes rows in-process. |
| `cleanupIntervalMs` | None | Legacy option; it is ignored and schedules no timer. |
| `installOnBootstrap` | `true` | Controls automatic trigger installation. |
| `uninstallWhenDisabled` | `false` | Removes generated triggers, but never journal rows. |
| `journalTableName` | `_mutation_journal` | Configures the journal table and index names. |

Targets may specify `dataSourceName` or a Nest provider `token`. A target with
neither property resolves TypeORM's default data source.

## Querying

Use `MutationJournalQueryService` for filtered reads:

```ts
const rows = await journalQuery.find(undefined, {
  tableName: 'orders',
  action: 'update',
  sinceMs: Date.now() - 86_400_000,
  limit: 50,
});
```

Apply authorization before exposing journal data because row snapshots can be
more sensitive than the mutation endpoint itself.

## Retention and cleanup

In-process retention is disabled because deleting audit history requires host
coordination that this library cannot prove. `cleanupIntervalMs` is retained
only for legacy option parsing and is ignored. It never schedules an
in-process timer.

When the module is enabled and `retentionDays` is configured,
`MutationJournalCleanupService.runOnce()` and the SQLite driver's `cleanup()`
reject with an explicit error instead of deleting rows. The service remains a
no-op while the module is disabled or when `retentionDays` is not configured.

Retention belongs to the host application's governed operational command. That
command must coordinate writers, preserve a durable report, include the SQLite
database and WAL/SHM/journal sidecars in verified backups, and provide failure
and rollback evidence.

## SQLite operations

- Installation is idempotent and preserves existing journal rows.
- Virtual tables, BLOB or untyped tables, and tables wider than 400 columns are
  skipped and reported.
- Every update is journaled, including writes that keep the same values.
- SQLite v1 writes `NULL` to `actor`.
- Call `MutationJournalService.refresh()` after migrations that create tables.
- Before dropping columns, uninstall generated triggers, perform the migration,
  and refresh the journal afterwards.
