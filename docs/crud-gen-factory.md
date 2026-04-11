# CRUD-Gen Dependency Factory Reference

CrudGen exposes small factories for each layer plus a compatibility combinator
for the common "generate everything" case. REST and GraphQL are API surfaces;
they should normally share the same service, dataloader, and repository
providers.

## Layered factories

- `CrudGenBackendFactory`: generates the backend provider layer only
  (service, dataloader, repository reference/tokens).
- `CrudGenGraphqlFactory`: generates GraphQL resolver providers only and points
  them at existing service/dataloader tokens.
- `crudRestControllerFactory`: generates REST controllers only and points them
  at an existing service token.
- `CrudGenResourceFactory`: combines backend, GraphQL, and REST generation with
  per-layer enable/disable flags.
- `CrudGenDependencyFactory`: compatibility helper for the original backend +
  GraphQL provider pack.

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

## Resource factory

Use `CrudGenResourceFactory` when an app owns the whole public API surface and
wants one declaration that composes the smaller factories:

```ts
const userResource = CrudGenResourceFactory({
  entityModel: UserEntity,
  backend: {
    service: { dbConnection: 'default' },
    dataloader: { databaseKey: 'id' },
  },
  graphql: {
    resolver: {
      dto: UserType,
      input: {
        create: UserCreateInput,
        update: UserUpdateInput,
        conditions: UserCondition,
      },
      prefix: 'Users_',
    },
  },
  rest: {
    dto: UserType,
    path: 'users',
    idField: 'id',
  },
});
```

Spread `userResource.providers` into module providers and
`userResource.controllers` into module controllers. Set any layer to `false` to
disable it, or omit `rest`/`graphql` when the app should not expose that surface.

For reusable substrates, prefer registering backend providers in the substrate
module and composing GraphQL/REST in the app. This keeps storage reusable and
makes the public API ownership explicit.

## Extended repository vs plain fallback
The generated stack can run in two modes:

- **Extended repository path**: full CRUD-Gen query semantics, including structured filters and richer query behavior.
- **Plain TypeORM fallback**: basic `find` / `findAndCount` semantics only.

Do not assume every GraphQL capability is available just because the generated args exist in the schema. Some capabilities, especially structured filtering, require the extended repository path.

## CrudGen-first decision guide

When designing a new module/app, prefer this order of decisions:

1. **Can the generated surface already express the use case?**
   - If yes, use `CrudGenDependencyFactory` directly.
2. **Do I only need custom business logic or persistence behavior?**
   - If yes, override the **service** and/or **repository** first.
3. **Do I only need a few extra API knobs?**
   - Prefer `extraArgs`, `extraInputs`, decorators, `readonly`, or `customQueries` before replacing the whole CRUD surface.
4. **Do I need a bespoke resolver/controller because the API contract itself is fundamentally non-generic?**
   - Only then introduce handwritten GraphQL/REST surface code.

In other words: for normal CRUD resources, custom code should usually live **below** the API surface (service/repository/mapping layers), not replace the generated resolver/controller stack.

## Recommended layering

### Basic app / happy path
Use:
- `CrudGenResourceFactory` when the app owns both REST and GraphQL
- `CrudGenDependencyFactory` for legacy backend + GraphQL provider packs
- generated resolver from `resolverFactory`
- generated REST controller from `crudRestControllerFactory`
- default `GenericService`

This is the intended baseline (see `examples/skeleton/app`).

### Advanced app with custom persistence/domain logic
Keep:
- generated resolver/controller surface where possible

Customize:
- **service provider** for domain behavior
- **repository provider** for advanced query semantics
- DTO metadata (`ModelObject` / `ModelField`) for joins, derived fields, aliases, and visibility

This is the preferred pattern for advanced integrations like OmniKernel-backed apps.

### Last resort: manual API surface
Use handwritten resolvers/controllers only when:
- the contract is not CRUD-shaped anymore, or
- CrudGen extension points are genuinely insufficient

Avoid replacing generated CRUD surfaces just because the persistence substrate is custom. A different backend is usually a reason to override the service/repository, not to abandon CrudGen.

## Implication for Omni-like backends

A reusable backend/substrate (for example OmniKernel) should aim to be:
- **CrudGen-compatible at the service/repository/model-metadata level**
- **not** a reason to duplicate CRUD GraphQL/REST layers manually

The more the backend supports relation metadata, derived fields, JSON-backed properties, and predictable repository behavior, the more consumers can stay CrudGen-first.
