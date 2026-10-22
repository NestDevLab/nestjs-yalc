# CrudGen repository and service capabilities

CrudGen keeps repository execution capabilities separate from the service's
GraphQL filter contract. A projection service can implement structured filters
without inheriting `GenericService` or using an extended TypeORM repository.

## Repository contract

Custom repositories should implement `CrudGenRepositoryCapabilityProvider`:

```ts
import type {
  CrudGenRepositoryCapabilities,
  CrudGenRepositoryCapabilityProvider,
} from '@nestjs-yalc/crud-gen';

class CustomRepository implements CrudGenRepositoryCapabilityProvider {
  getCrudGenCapabilities(): Partial<CrudGenRepositoryCapabilities> {
    return {
      extendedQueries: false,
      structuredGraphqlFilters: false,
    };
  }
}
```

`resolveCrudGenRepositoryCapabilities(repository)` is the canonical adapter used
by `GenericService.getCrudGenRepositoryCapabilities()`. The existing capability
type and plain defaults remain exported from `typeorm/generic.repository.js`;
they are also available from the package root and `crud-gen-capabilities.js`.
`GenericTypeORMRepository` already explicitly declares both flags as `true`.

| Flag | Meaning |
| --- | --- |
| `extendedQueries` | `GenericService` can delegate to `getManyExtended` and `getManyAndCountExtended`. |
| `structuredGraphqlFilters` | The service backed by this repository can accept structured GraphQL filters. |

The flags are independent. An explicit provider takes precedence over legacy
signals and incidental method presence. Omitted flags default to `false`, even
if extended methods exist. Known flags must be booleans; `undefined`, `null`,
strings and numbers are invalid when supplied as flag values. A non-function
provider or a provider returning a non-object or array throws `TypeError`.
Provider exceptions propagate. Unknown keys are ignored for forward
compatibility. Invalid declarations never fall back to inference.

Capability resolution describes support; it does not execute repository methods.
When extended execution is requested with `extendedQueries: true`,
`GenericService.getEntityListExtended` requires both extended methods and throws
`ReferenceError` before delegation if either is missing. With `false`, it uses
the existing sanitized plain TypeORM `find`/`findAndCount` path. Advertising
structured filter support does not add filter execution to a plain repository:
custom implementations must provide the semantics they advertise, and the
plain TypeORM restrictions still apply.

Resolution happens on each call, so repository replacement or database switching
does not retain stale capability decisions. Provider methods keep their `this`
binding, and resolved objects do not mutate the provider's declaration.

## Service contract used by GraphQL resolvers

Services should implement `CrudGenStructuredGraphqlFilterProvider` with
`supportsStructuredGraphqlFilters(): boolean`. The grid resolver uses
`supportsCrudGenStructuredGraphqlFilters(service)` and honors explicit `false`
even if `supportsExtendedRepository()` returns `true`. `GenericService` derives
these methods from repository capabilities; projection services expose their
own implementation. The adapter does not inspect a service's repository or
interpret a repository provider on a service as a service declaration.

Without the independent service method, the adapter retains the legacy
`supportsExtendedRepository()` fallback. A service exposing neither signal can
serve basic grid queries, but structured filters are rejected before list
execution. Projection filtering retains its existing supported-shape
restrictions; the capability does not broaden projection boolean expressions.

## Legacy compatibility and migration

Repository inference is isolated in the compatibility boundary in
`crud-gen-capabilities.ts`. When `getCrudGenCapabilities` is absent:

1. `supportsExtendedRepository()` remains authoritative if present, including
   an explicit false result.
2. Otherwise, both extended query methods must exist to infer support.
3. The inferred value supplies both flags, preserving historical behavior.

The legacy repository and service signals retain their historical boolean
coercion. New typed implementations should return actual booleans.

Migrate a custom repository by adding the explicit provider and declaring each
supported flag; implement both extended methods before enabling extended
queries. Migrate a custom service by adding its independent filter-support
method. No existing method or subpath export is removed, and consumers using
legacy implementations do not need a forced major-version migration.

Legacy inference is retained until a separately announced compatibility release
can establish that first-party and documented consumer implementations use
explicit contracts, publish a deprecation period and migration guidance, and
carry regression coverage for plain repositories and projection services. Any
removal requires a deliberate breaking-change decision; this change introduces
no removal deadline.
