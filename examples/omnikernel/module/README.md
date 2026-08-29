# OmniKernel Module

`@nestjs-yalc/omnikernel-module` is a private workspace package that provides
the reusable OmniKernel persistence substrate. It is buildable with the normal
root workspace build, but is not a published framework package.

The module deliberately contains no REST controllers, GraphQL resolvers, or
application authentication. A consuming app owns those protocol and trust
boundaries by composing the exported backend factories with CrudGen.

## Build and package boundary

The root `npm run build` first emits the shared workspace declarations and
then builds this module into `dist/src`. The package manifest exports only that
compiled directory and declares only versioned internal dependencies, so a
tarball does not depend on a consumer being adjacent to this repository.

```bash
npm run build
npm pack --dry-run --json ./examples/omnikernel/module
```

The package stays `private` and is excluded from the public framework export
and publishing pipeline. `dist` is generated output and is not committed.

## Server-owned scope

Every Omni resource has a composite `(scopeId, guid)` identity. `scopeId` is
never an API input or output field: the request-scoped `OmniScopeContext`
derives it from a trusted adapter or an explicitly configured server default.
All generated CRUD reads, grids, mutations, relations, external references,
repositories, and dataloader cache keys use that context.

```ts
import { OmniKernelModule } from "@nestjs-yalc/omnikernel-module";

@Module({
  imports: [
    OmniKernelModule.register({
      dbConnection: "default",
      resolveScope(request) {
        return authenticateRequest(request).scopeId;
      },
      relationKinds: ["blocks"],
    }),
  ],
})
export class AppModule {}
```

`resolveScope` must authenticate and authorize the request before returning a
scope. When a resolver is configured, an absent or invalid result fails closed
and never falls back to the default partition. The optional `defaultScopeId` is
a server configuration compatibility partition only for an app without an
adapter; it does not read a client field.

## Resources and lifecycle

| Resource           | Delete policy | Scoped database protection                  |
| ------------------ | ------------- | ------------------------------------------- |
| Named              | hard delete   | composite primary key                       |
| Record             | tombstone     | composite primary key and grid index        |
| Document           | tombstone     | record inheritance and grid index           |
| Collection         | tombstone     | record inheritance and grid index           |
| Relation           | hard delete   | composite foreign keys and endpoint indexes |
| External reference | hard delete   | scoped external-identity unique index       |

The default policies can be overridden at registration with `deletion`. A
tombstoned resource is excluded from normal generated reads and mutations; the
row remains available for a retention or recovery workflow owned by the app.

Relations preserve the canonical `contains`, `references`, `related_to`, and
`derived_from` constants. An app may register further lowercase relation kinds
through `relationKinds`; unregistered kinds are rejected. Canonical endpoint
semantics remain enforced, while extra kinds have no hidden generic policy.

## Omni-owned extension projections

An extension projection adds typed, generated CRUD without making a second
root identity. Its dynamically generated table has `(scopeId, guid)` and a
composite foreign key to `omni-record`; the owner remains the only authority
for scope, identity, revision, timestamps, deletion, kind, and payload-schema
metadata. The extension owns only its declared promoted columns and `payload`.

Use `createOmniExtensionProjectionEntity` and
`createOmniExtensionProjectionRegistration` from the package entrypoint. A
registration returns its TypeORM entity, one generated CrudGen REST controller,
one generated GraphQL resolver, its request-scoped service and dataloader
providers, a fixed owner-kind reservation, and a reader registration. Compose
those returned values into the app module; do not add a hand-written controller
or resolver for ordinary create/read/grid/update/delete operations.

Register every returned `reservedRecordKinds` value with
`OmniKernelModule.register`. The generic record service then rejects creating,
changing into, updating, or deleting an extension-owned record kind. The
extension service is the sole generic path that can transact the owner and its
extension row together.

The extension table uses JSON1 text on SQLite and native `jsonb` on PostgreSQL.
All JSON reads, predicates, mutation expressions, indexes, and inspection stay
inside `ProjectionDialect`; applications only declare projection metadata.
Owner revision is the optimistic-concurrency value exposed by both generated
transports.

### Lifecycle policies and transaction readers

An optional `OmniProjectionLifecycleProvider` accepts a Nest injection token,
not a prebuilt policy instance. Give the same token to an extension and/or
relation registration. The factory resolves the request-scoped policy and runs
`beforeCreate`, `beforeUpdate`, and `beforeDelete` in the store transaction,
so REST and GraphQL have identical enforcement.

If the application and this file package resolve separate physical copies of
`@nestjs/core`, pass the application's `ModuleRef` provider token as
`moduleRefToken` to each registration. CrudGen injects that explicit token into
the generated resolver; no optional dependency or consumer cast is required.

Build one `createOmniProjectionReaderCatalogProvider` from the `reader` values
returned by the registrations. Lifecycle contexts receive the active
`EntityManager` and manager-bound `readers`, rather than repositories. An
extension reader supports declared equality filters and `take: 1..1000`; a
relation reader supports scoped source/target filters and the same bounded
`take`. Readers always enforce their registration's owner or relation metadata.
Lifecycle-bearing writes use `SERIALIZABLE`; serialization or SQLite busy
failures are reported as retryable conflicts.

## Relation projections

`createOmniRelationProjectionRegistration` creates one generated REST,
GraphQL, and dataloader surface over the existing `omni-relation` table. It
never creates a duplicate relation table. A definition has either legacy fixed
`kind` or a non-empty unique `allowedKinds` list, fixed source/target record
kinds, and fixed status/schema metadata. For a multi-kind resource, create
requires one allowed kind; all reads, grids, updates, and deletes mechanically
constrain that set and the fixed metadata. Endpoints and kind are immutable;
payload updates require `expectedRevision` and atomically increment revision.

Definitions may map public `kind`, `source`, `target`, and `payload` aliases to
the native relation fields, keeping generated transports application-neutral.
Relations require same-scope endpoints and retain the registered endpoint-kind
checks. `OmniRelationEntity.payload` remains the existing portable
`simple-json` column on both drivers; unlike an extension projection it is not
advertised as PostgreSQL `jsonb`.

## Versioned migration snapshots

`captureOmniMigrationSnapshot` is an authoring-only helper. Capture it while
reviewing a schema, copy the resulting literal into a versioned migration, and
pass that literal through `defineOmniMigrationSnapshot` and
`createOmniMigrationPlan`. A runtime migration never reads current TypeORM
metadata or runs synchronize. The immutable snapshot includes both table
options and dialect-compiled expression-index statements.

`plan.create(queryRunner)` creates foreign-key parents before children, then
creates expression indexes. `plan.drop(queryRunner)` drops the reverse order.
The accepted argument is the package-owned `OmniMigrationRunner` capability
contract (`createTable` and `query`), so an app's TypeORM `QueryRunner` works
without a cast even when package-manager paths duplicate TypeORM. Cross-table
foreign-key cycles and a missing referenced snapshot table fail clearly during
migration authoring.
This keeps app migrations free of repeated projection SQL and supports
reversible SQLite and PostgreSQL migrations.

## Payload contract

Raw `payload` accepts a JSON object or `null`. Writes replace the complete
value; OmniKernel does not provide raw JSON patching or typed payload filters.
`payloadSchemaId` and positive `payloadSchemaVersion` are supplied together to
identify the app-owned schema revision.

The raw Omni payload is `simple-json`, so it is portable but opaque to the
generic API, including PostgreSQL. Use the separate CrudGen scoped projection
contract when a resource needs native PostgreSQL `jsonb`, typed filtering,
sorting, or revision patch semantics; see
[`docs/crud-gen-projections.md`](../../../docs/crud-gen-projections.md).

## Indexes and bounded diagnostics

The schema declares driver-portable composite indexes for record grid reads,
relation source/target traversal, and external-reference lookup, plus scoped
uniqueness for relations and external identities. `collectOmniKernelQueryPlanEvidence`
uses diagnostic-only `EXPLAIN` statements for the record grid and relation
source shapes. It does not replace TypeORM CRUD or certify a production scale
SLA; callers must run their own production-volume measurements.

## Exports

The package exports entities, DTO metadata, scoped services and repositories,
dataloaders, backend provider factories, relation-kind helpers, query helpers,
and diagnostic helpers. Runtime imports resolve to `dist`, not TypeScript
source files.

Use `examples/omnikernel/app` for generated REST and GraphQL composition.
