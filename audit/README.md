# @nestjs-yalc/audit

Engine-level database mutation journal utilities for NestJS applications.

`@nestjs-yalc/audit` records row inserts, updates, and deletes with database
triggers, so mutations made through TypeORM, query builders, or direct SQL are
captured in the same transaction as the source change. The first driver supports
SQLite; the public driver interface is ready for additional engines.

## Installation

```bash
npm install @nestjs-yalc/audit sqlite3
```

## Quick start

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MutationJournalModule } from '@nestjs-yalc/audit';

@Module({
  imports: [
    TypeOrmModule.forRoot({ type: 'sqlite', database: 'app.sqlite' }),
    MutationJournalModule.forRoot({
      enabled: true,
    }),
  ],
})
export class AppModule {}
```

See the [mutation journal guide](../docs/mutation-journal.md) for target
selection, querying, governed host retention, SQLite limits, and operational
guidance. In-process cleanup is intentionally disabled because the library
cannot coordinate application writers or persist host-level rollback evidence.
