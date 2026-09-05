---
title: Mutation journal
description: Record SQLite database mutations with transactionally coupled triggers.
permalink: /mutation-journal
---

# Mutation journal

`@nestjs-yalc/audit` records row-level inserts, updates, and deletes in a
journal table owned by the database. The initial driver supports SQLite and
the public driver interface is ready for PostgreSQL and other engines.

## Why database triggers

An ORM subscriber only observes work performed through that ORM instance. It
does not reliably see direct SQL, query-builder operations that bypass entity
hooks, administrative scripts, or another process using the same database.
The mutation journal uses `AFTER INSERT`, `AFTER UPDATE`, and `AFTER DELETE`
triggers instead, so the database captures every supported row mutation.

The journal insert happens in the same database transaction as the source
mutation. If the source transaction rolls back, its journal rows roll back as
well. This is a journal for persisted database changes, not an application
event stream.

## Quick start

Install the audit package and the SQLite driver used by TypeORM:

```bash
npm install @nestjs-yalc/audit sqlite3
```

Add the module after the application's TypeORM configuration:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MutationJournalModule } from '@nestjs-yalc/audit';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'app.sqlite',
    }),
    MutationJournalModule.forRoot({
      enabled: true,
    }),
  ],
})
export class AppModule {}
```

By default the module targets TypeORM's default data source, creates the
`_mutation_journal` table, and installs SQLite triggers at application
bootstrap. Reports are available from `MutationJournalService.getReports()`.

## Reference integration

The [task example app module](../examples/task/app/apps/task-system-app/src/app.module.ts)
uses the module immediately after `TypeOrmModule.forRoot()`. It enables the
journal by default; set `MUTATION_JOURNAL_ENABLED=false` to disable it.

## Configuration

`MutationJournalModule.forRoot()` receives `MutationJournalOptions`.

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `enabled` | `boolean` | Required | Enables trigger installation and journal reads. |
| `targets` | `MutationJournalTargetRef[]` | `[{}]` | Data sources to journal. A target accepts `dataSourceName` or a Nest provider `token`; `token` takes precedence. |
| `excludedTables` | `string[]` | `[]` | Adds application tables that must not receive triggers. `migrations` and `typeorm_metadata` are always excluded. |
| `retentionDays` | `number` | None | Legacy compatibility option. In-process cleanup is disabled; use a governed host retention command. |
| `cleanupIntervalMs` | `number` | None | Legacy compatibility option. It is ignored; no in-process retention timer is scheduled. |
| `installOnBootstrap` | `boolean` | `true` | Set to `false` to call `MutationJournalService.install()` or `refresh()` yourself. |
| `uninstallWhenDisabled` | `boolean` | `false` | When `enabled` is `false`, removes generated journal triggers at bootstrap. The journal table and its rows remain. |
| `journalTableName` | `string` | `_mutation_journal` | Name of the journal table and generated indexes. The table itself is never journaled. |
| `drivers` | `IMutationJournalDriver[]` | SQLite trigger driver | Replaces the built-in driver list for custom or future database engines. |
| `actorSetting` | `string` | None | Driver-specific actor context setting. SQLite v1 keeps `actor` as `NULL`. |

### Asynchronous configuration and named data sources

Use `forRootAsync()` when configuration comes from a provider. A normal named
TypeORM data source uses the same name in `targets`:

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MutationJournalModule } from '@nestjs-yalc/audit';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      name: 'billing',
      type: 'sqlite',
      database: 'billing.sqlite',
    }),
    MutationJournalModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        enabled: config.getOrThrow<boolean>('AUDIT_ENABLED'),
        targets: [{ dataSourceName: 'billing' }],
      }),
    }),
  ],
})
export class AppModule {}
```

YALC applications that derive connection names with `getConnectionName()`
should use that exact derived value for both TypeORM and the journal target:

```ts
import { getConnectionName } from '@nestjs-yalc/database/conn.helper.js';

const connectionName = getConnectionName('billing'); // "billingConnection"

TypeOrmModule.forRoot({
  name: connectionName,
  type: 'sqlite',
  database: 'billing.sqlite',
});

MutationJournalModule.forRoot({
  enabled: true,
  targets: [{ dataSourceName: connectionName }],
});
```

For data sources exposed through a custom Nest provider, use
`targets: [{ token: MY_DATA_SOURCE_TOKEN }]` instead. A target with neither
property resolves TypeORM's default data source.

## Journal schema and querying

SQLite creates this table on installation (the name is configurable):

| Column | Meaning |
| --- | --- |
| `id` | Autoincrement journal row identifier. |
| `occurredAt` | Unix epoch milliseconds, assigned by SQLite. |
| `tableName` | Source table name. |
| `action` | `insert`, `update`, or `delete`. |
| `oldRow` | JSON snapshot before an update or delete; `NULL` for inserts. |
| `newRow` | JSON snapshot after an insert or update; `NULL` for deletes. |
| `actor` | Actor context. It is `NULL` in the SQLite v1 driver. |

Indexes are created for `occurredAt` and for `(tableName, occurredAt)`.

Use `MutationJournalQueryService` for filtered reads. It returns the raw
`MutationJournalRow` shape so callers can choose when to parse JSON:

```ts
import {
  MutationJournalQueryService,
  parseMutationJournalRow,
} from '@nestjs-yalc/audit';

const rows = await journalQuery.find(undefined, {
  tableName: 'orders',
  action: 'update',
  sinceMs: Date.now() - 86_400_000,
  limit: 50,
});

const parsedRows = rows.map(parseMutationJournalRow);
```

`find()` accepts `tableName`, `action`, `sinceMs`, `untilMs`, `limit`, and
`offset`. Omitted `limit` defaults to `100`; results are newest first. Apply
authorization before exposing journal data: snapshots can contain application
data that is more sensitive than the mutation endpoint itself.

## Retention and cleanup

In-process retention is disabled because deleting audit history requires host
coordination that this library cannot prove. `cleanupIntervalMs` is retained
only for legacy option parsing and is ignored; it never schedules an
in-process timer. When the module is enabled and `retentionDays` is configured,
`MutationJournalCleanupService.runOnce()` and the SQLite driver's `cleanup()`
method reject with an explicit error instead of deleting rows. The service
remains a no-op while the module is disabled or when `retentionDays` is not
configured.

Run retention from the host application's governed operational command. That
command must coordinate writers, preserve a durable report, account for the
SQLite database and its WAL/SHM/journal sidecars, and provide failure and
rollback evidence.

## SQLite semantics and limits

- Installation is idempotent. It removes the driver's generated `_mj_` triggers
  and regenerates the three journal triggers for every eligible table. Existing
  journal rows are preserved.
- SQLite virtual tables are skipped. Tables with a `BLOB` column, an untyped
  column, or more than 400 columns are also skipped and reported in the install
  report. Add intentional exclusions with `excludedTables`.
- JSON generation is chunked in groups of 40 columns before SQLite combines the
  result. This avoids SQLite function-argument limits for wide supported tables.
- Every `UPDATE` is journaled, including an update that writes the same values.
  SQLite v1 has no `skipNoopUpdates` option.
- SQLite JSON numbers follow SQLite and JavaScript numeric semantics. Store IDs
  that can exceed JavaScript's safe integer range as text if exact client-side
  JSON round-tripping is required.
- SQLite v1 writes `NULL` to `actor`. `actorSetting` is reserved for drivers
  that support connection-scoped actor context.

## Operations

Call `MutationJournalService.refresh()` after creating tables at runtime or
after a migration that creates new application tables. Refreshing regenerates
the driver's triggers across the configured targets:

```ts
await mutationJournalService.refresh();
```

Before a SQLite migration that uses `DROP COLUMN`, uninstall the generated
triggers, run the migration, then refresh them. Otherwise a trigger can still
refer to the removed column:

```ts
await mutationJournalService.uninstall();
await runMigration();
await mutationJournalService.refresh();
```

Concurrent application boots can compete for SQLite schema locks while they
create the journal table and triggers. Configure a suitable SQLite
`busy_timeout` for the deployment, for example `PRAGMA busy_timeout = 5000`,
and avoid running schema-changing boots simultaneously when possible.

## Roadmap

- PostgreSQL driver using `plpgsql`, `to_jsonb`, and
  `current_setting('app.actor', true)` for actor context.
- A request-context interceptor that supplies actor information to supported
  database drivers.
- An opt-in `skipNoopUpdates` policy for engines that can compare old and new
  rows efficiently.
