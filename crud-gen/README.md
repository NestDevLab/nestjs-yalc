# @nestjs-yalc/crud-gen

Factory-driven CRUD generator for NestJS with TypeORM and GraphQL/REST helpers (resolvers/controllers, services, dataloaders, repositories, DTO/field mapping).

## Install & build (from repo root)

- `npm ci`
- Build: `npm run build`
- Tests/coverage: `npm run test:cov` (uses Jest projects; set `JEST_WORKERS` to limit parallelism)

The canonical build materializes `crud-gen/dist/src` from the compiled
workspace output. `npm pack ./crud-gen` therefore produces a normal local
package containing JavaScript and declarations. Packing before a canonical
build fails with a build-ready error instead of creating a metadata-only
tarball.

### Local OmniKernel consumers

Build this repository first. Local consumers depend on the built source
packages, not `var/dist` or a registry CrudGen release. Configure the package
manager so OmniKernel resolves the same CrudGen artifact as the direct
dependency.

#### npm consumers

For a non-pnpm sibling application, use npm's root `overrides` field:

```json
{
  "dependencies": {
    "@nestjs-yalc/crud-gen": "file:../nestjs-yalc/crud-gen",
    "@nestjs-yalc/omnikernel-module": "file:../nestjs-yalc/examples/omnikernel/module"
  },
  "overrides": {
    "@nestjs-yalc/omnikernel-module": {
      "@nestjs-yalc/crud-gen": "$@nestjs-yalc/crud-gen"
    }
  }
}
```

Run `npm run build` in this repository before installing those dependencies,
then run `npm install` in the consumer to record the local package identities.

#### pnpm sibling workspaces

For an unpublished cross-repository build, pin the consumed
`@nestjs-yalc/*` dependency closure to the materialized local packages in the
consumer's workspace-root `pnpm-workspace.yaml`. This prevents a transitive
semver dependency from silently falling back to an older registry artifact.
Paths are relative to the workspace file:

```yaml
overrides:
  '@nestjs-yalc/crud-gen': 'file:../nestjs-yalc/crud-gen'
  '@nestjs-yalc/data-loader': 'file:../nestjs-yalc/data-loader'
  '@nestjs-yalc/database': 'file:../nestjs-yalc/database'
  '@nestjs-yalc/errors': 'file:../nestjs-yalc/errors'
  '@nestjs-yalc/event-manager': 'file:../nestjs-yalc/event-manager'
  '@nestjs-yalc/field-middleware': 'file:../nestjs-yalc/field-middleware'
  '@nestjs-yalc/graphql': 'file:../nestjs-yalc/graphql'
  '@nestjs-yalc/interfaces': 'file:../nestjs-yalc/interfaces'
  '@nestjs-yalc/types': 'file:../nestjs-yalc/types'
  '@nestjs-yalc/utils': 'file:../nestjs-yalc/utils'
```

Add direct local dependencies with paths relative to the consuming package:

```json
{
  "dependencies": {
    "@nestjs-yalc/crud-gen": "file:../../nestjs-yalc/crud-gen",
    "@nestjs-yalc/omnikernel-module": "file:../../nestjs-yalc/examples/omnikernel/module"
  }
}
```

After `npm run build` in this repository, run `pnpm install` from the consumer
workspace root. The direct dependencies and workspace overrides then resolve
to one compiled local package graph. Add any further `@nestjs-yalc/*` package
used by the application to the same local override set; do not mix unpublished
local framework changes with older registry artifacts.

## Quick start

When the app owns the whole resource surface, use the resource combinator:

```ts
export const userResource = CrudGenResourceFactory<User>({
  entityModel: User,
  graphql: true,
  rest: true,
});
```

By default, the resource factory uses the default TypeORM connection, infers the
dataloader key and REST id field from a single TypeORM primary column, and
generates the default service, dataloader, GraphQL resolver, and REST
controller. Omit `graphql` or `rest` when the app should not expose that
surface.

Customize only the surfaces that need application-specific contracts:

```ts
export const userResource = CrudGenResourceFactory<User>({
  entityModel: User,
  graphql: {
    resolver: {
      dto: UserType,
      input: {
        create: UserCreateInput,
        update: UserUpdateInput,
        conditions: UserCondition,
      },
    },
  },
  rest: {
    dto: UserType,
    path: 'users',
    idField: 'id',
  },
});
```

Spread `userResource.providers` into module providers,
`userResource.controllers` into module controllers, and pass
`userResource.repository` to `TypeOrmModule.forFeature`.
Set `backend.dbConnection` when the resource uses a named TypeORM connection.
Set `backend.databaseKey` when the model has no single primary column or uses a
custom dataloader key.

For existing GraphQL-only modules, the compatibility helper still creates the
backend and resolver providers together:

```ts
export const userProviders = CrudGenDependencyFactory<User>({
  entityModel: User,
  resolver: {
    dto: UserType,
    input: {
      create: UserCreateInput,
      update: UserUpdateInput,
      conditions: UserCondition,
    },
  },
  service: { dbConnection: 'default' },
  dataloader: { databaseKey: 'id' },
});
```

Spread `userProviders.providers` into your module providers and pass `userProviders.repository` to `TypeOrmModule.forFeature`.

## Key pieces

- Decorators: `ModelObject`, `ModelField` (mapping, relations, filters, derived fields)
- Resource composition: `CrudGenResourceFactory` combines backend, GraphQL, and REST generation with per-surface enable/disable options.
- Layer factories: `CrudGenBackendFactory` for service/repository/dataloader providers, `CrudGenGraphqlFactory` for resolver providers against existing backend tokens, and `CrudGenDependencyFactory` for the legacy backend + GraphQL pack.
- Lower-level factories: `GenericServiceFactory` (service), `DataLoaderFactory` (dataloader), `CGExtendedRepositoryFactory` (repository)
- GraphQL helpers: argument/condition builders, extra args/inputs, generated resolvers
- REST helpers: `CGQueryArgs`, pagination/filter/sorting DTOs, Swagger response helper, `crudRestControllerFactory` to generate full CRUD controllers (list/getById/create/update/delete) wired to your `GenericService`, with optional `readonly`, structured JSON `sorting`/`filters`, flat equality query filters, custom `serviceToken`, and per-mutation toggles
- Errors: entity CRUD errors, missing arguments/conditions

## Scoped JSON projections

`defineProjectionResource` declares one immutable, server-scoped projection
contract. It drives generated REST/GraphQL DTOs, TypeORM schema options,
capability checks, typed SQLite/PostgreSQL queries, expression indexes, and a
revision-checked generic service. The consuming application provides only a
trusted scope adapter, repository, and one metadata declaration; it does not
provide custom standard CRUD methods, duplicate JSON-path logic, or dialect
SQL.

Use the `uuid` codec for canonical UUID identifiers. It generates `UUIDScalar`
fields for GraphQL object/create/patch/conditions shapes and validates the same
canonical value before REST/service persistence or projection SQL.

See [Scoped JSON projections](../docs/crud-gen-projections.md) for the public
metadata contract, generated read/write semantics, query capabilities,
SQLite/PostgreSQL behavior, migration-oriented index DDL, promotion policy,
limitations, and runnable verification.

> Note: some helpers are imported from subpaths (e.g., `@nestjs-yalc/crud-gen/object.decorator`, `.../crud-gen.helpers`) while the top-level `src/index.ts` export surface is being finalized.

## Documentation

- Documentation index:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/documentation.md
- GraphQL CRUD guide:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/api-creation.md
- Modeling with `ModelObject` and `ModelField`:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/crud-gen-modeling.md
- Dependency factory options:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/crud-gen-factory.md
- REST usage:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/crud-gen-rest.md
