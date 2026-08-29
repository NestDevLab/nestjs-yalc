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
scope. The optional `defaultScopeId` is a server configuration compatibility
partition for an app without an adapter; it does not read a client field.

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
