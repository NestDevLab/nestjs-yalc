# @nestjs-yalc/crud-gen

Factory-driven CRUD generator for NestJS with TypeORM and GraphQL/REST helpers (resolvers/controllers, services, dataloaders, repositories, DTO/field mapping).

## Install & build (from repo root)
- `cd workspaces/nestjs-yalc && npm ci`
- Build: `npm run build`
- Tests/coverage: `npm run test:cov` (uses Jest projects; set `JEST_WORKERS` to limit parallelism)

## Quick start
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
- Factories: `CrudGenDependencyFactory`, `GenericServiceFactory` (service), `DataLoaderFactory` (dataloader), `CGExtendedRepositoryFactory` (repository)
- GraphQL helpers: argument/condition builders, extra args/inputs, generated resolvers
- REST helpers: `CGQueryArgs`, pagination DTOs, Swagger response helper, `crudRestControllerFactory` to generate full CRUD controllers (list/getById/create/update/delete) wired to your `GenericService`, with optional `readonly` and per-mutation toggles
- Errors: entity CRUD errors, missing arguments/conditions

> Note: some helpers are imported from subpaths (e.g., `@nestjs-yalc/crud-gen/object.decorator`, `.../crud-gen.helpers`) while the top-level `src/index.ts` export surface is being finalized.

## Documentation
- Overview: `../docs/README.md`
- GraphQL CRUD guide: `../docs/api-creation.md`
- Modeling (ModelObject/ModelField): `../docs/crud-gen-modeling.md`
- Dependency factory options: `../docs/crud-gen-factory.md`
- REST usage: `../docs/crud-gen-rest.md` (includes controller factory); note you can also expose REST via GraphQL Sofa if you prefer automatic REST from resolvers.
