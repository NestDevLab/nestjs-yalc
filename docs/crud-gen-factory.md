# CRUD-Gen Dependency Factory Reference

`CrudGenDependencyFactory` wires a CRUD stack (resolver/controller, service, dataloader, repository) around a TypeORM entity and optional DTOs.

## Options (`ICrudGenDependencyFactoryOptions`)
- `entityModel` (required): TypeORM entity class.
- `resolver`: configure or override the generated resolver.
  - Pass `false` to skip resolver creation.
  - Pass resolver options (same shape as `resolverFactory`) to tune queries/mutations:
    - `prefix`, `queries`, `mutations`, `dto`, `input`, `extraArgs`, `extraArgsStrategy`, `extraInputs`, `decorators`, `readonly`, etc.
  - Or pass `{ provider: CustomResolverClass }` to use your own resolver.
- `service`: wire the service:
  - `{ dbConnection, entityModel?, providerClass? }` to get a generated `GenericService` provider (connection-aware).
  - Or `{ provider }` to supply your own provider token/class/value/factory.
- `dataloader`:
  - `{ databaseKey, entityModel? }` to generate a dataloader bound to the service.
  - Or `{ provider }` to supply your own provider.
- `repository`: custom `GenericTypeORMRepository` class if you need an override.

## What it returns
- `providers`: array to spread into your module providers (includes resolver/service/dataloader as configured).
- `repository`: the repository class produced or referenced by the factory. Treat this primarily as an override/reference token, not as the default value to pass to `TypeOrmModule.forFeature(...)` in normal app wiring.

In the common module setup shown by the live examples, `TypeOrmModule.forFeature(...)` should register the **entity classes**, while the dependency factory contributes providers on top of that.

## Tokens & helpers
- Providers created by the factory emit predictable tokens via `getProviderToken(entity)` and `getServiceToken(entity)`.
- Dataloader wiring also depends on consistent type tokens. In practice, `relation.type` must line up with the type/token that the dataloader resolver path expects.
- If you override providers, ensure tokens line up with what your resolver/service/dataloader expects.

## Patterns
- Start simple: supply `entityModel`, `service.dbConnection`, `dataloader.databaseKey`, and DTO/input classes in `resolver`.
- Customization: override resolver for bespoke queries/mutations; override service for domain logic; override repository for views/write-model splits.
- Extra args/inputs: use `extraArgs` for required filters; `extraInputs` to extend mutations (e.g., flags/middleware to adjust input).
- Disable pieces: set `resolver: false` if you only need the service/dataloader/repository (e.g., headless usage).

## Extended repository vs plain fallback
The generated stack can run in two modes:

- **Extended repository path**: full CRUD-Gen query semantics, including structured filters and richer query behavior.
- **Plain TypeORM fallback**: basic `find` / `findAndCount` semantics only.

Do not assume every GraphQL capability is available just because the generated args exist in the schema. Some capabilities, especially structured filtering, require the extended repository path.
