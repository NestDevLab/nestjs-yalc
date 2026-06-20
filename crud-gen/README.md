# @nestjs-yalc/crud-gen

Factory-driven CRUD generator for NestJS with TypeORM and GraphQL/REST helpers (resolvers/controllers, services, dataloaders, repositories, DTO/field mapping).

## Install & build (from repo root)
- `npm ci`
- Build: `npm run build`
- Tests/coverage: `npm run test:cov` (uses Jest projects; set `JEST_WORKERS` to limit parallelism)

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
