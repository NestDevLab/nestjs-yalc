# @nestjs-yalc/database

Database helpers for TypeORM-based YALC applications.

The package contains configuration builders, migration and operation services,
global migration registration helpers, repository utilities, JSON field helpers,
and query builder helpers.

## Installation

```bash
npm install @nestjs-yalc/database
```

Install the TypeORM driver package required by your application, such as
`mysql2`, `pg`, or `sqlite3`.

## Main Exports

- `buildDbConfigObject` for building TypeORM connection options from
  environment-style configuration.
- `DbMigrateService` and `DbMigrationServiceFactory` for migration execution.
- `DbOpsService` and `DbOpsServiceFactory` for database operations.
- TypeORM migration registration helpers such as `setGlobalMigrationClasses`.
- `yalcTypeOrmPostgresOptions` for Postgres option normalization.

## Example

```ts
import { buildDbConfigObject } from '@nestjs-yalc/database';

const dbConfig = buildDbConfigObject({
  dbName: 'app',
  entities: [UserEntity],
  migrationsDir: 'dist/database/migrations',
});
```

## Documentation

- Backend blueprint:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/backend-blueprint.md
- Integration guide:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/how-to-integrate-nestjs-yalc.md
