# @nestjs-yalc/crud-gen

## 1.5.0

### Minor Changes

- 2eef9de: Add generic boolean projection fields and Omni-owned extension and relation
  projection composition. Generated REST and GraphQL resources now support
  server-owned extension identities, bounded multi-kind relation semantics,
  transaction-aware lifecycle policies, bounded manager-bound readers, immutable
  versioned migration snapshots, reversible migration plans, and explicit
  consumer-owned `ModuleRef` injection tokens on SQLite and PostgreSQL.
- b3b3597: Add server-scoped JSON projection resources with generated REST and GraphQL
  CRUD, optimistic partial updates, typed filtering and sorting, migration-ready
  indexes, signed 32-bit integer semantics, and portable SQLite and PostgreSQL
  dialects.
- 4363633: Add a fail-closed `uuid` projection codec with generated GraphQL `UUID` fields
  and portable validated-text SQLite/PostgreSQL query support.

### Patch Changes

- d7b9575: Resolve generated GraphQL relation loaders from the active request context so
  request-scoped services and tenant-aware loader caches retain their scope.
- ab50237: Declare the complete runtime dependency and peer graph reached by a standalone
  CrudGen installation. This lets consumers install `@nestjs-yalc/crud-gen`
  directly without relying on the aggregate framework package to hoist missing
  dependencies.
- Updated dependencies [8d3d378]
- Updated dependencies [ab50237]
  - @nestjs-yalc/event-manager@1.3.4
  - @nestjs-yalc/data-loader@1.3.4
  - @nestjs-yalc/database@1.3.4
  - @nestjs-yalc/field-middleware@1.3.4
  - @nestjs-yalc/graphql@1.3.4
  - @nestjs-yalc/utils@1.3.4

## 1.4.0

### Minor Changes

- d74f83e: Add default backend inference, REST id-field inference, and compact `graphql` and `rest` shorthands to `CrudGenResourceFactory`.

### Patch Changes

- Publish npm-safe README files for every package and prevent Jekyll landing-page
  markup from being copied into npm tarballs.
- Updated dependencies
  - @nestjs-yalc/data-loader@1.3.3
  - @nestjs-yalc/database@1.3.3
  - @nestjs-yalc/field-middleware@1.3.3
  - @nestjs-yalc/graphql@1.3.3
  - @nestjs-yalc/interfaces@1.3.3
  - @nestjs-yalc/types@1.3.3
  - @nestjs-yalc/utils@1.3.3
