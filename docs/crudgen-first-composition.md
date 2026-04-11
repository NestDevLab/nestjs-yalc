# CrudGen-first Composition Guide

This guide describes the intended decision order when building new backends on
top of `nestjs-yalc`.

The short version is:

1. model the DTO contract with `ModelObject` / `ModelField`
2. generate the GraphQL and REST CRUD surface with CrudGen
3. override services and repositories when domain semantics require it
4. keep handwritten controllers/resolvers only for truly non-CRUD operations

## Why this guide exists

CrudGen already supports more than the simplest happy-path examples suggest:

- generated GraphQL CRUD and grid queries
- generated REST CRUD controllers
- DTO-driven field metadata
- relation metadata
- service override patterns
- repository override patterns
- dataloader override patterns
- extra args and extra inputs
- readonly and custom query modes

Teams often bypass those capabilities too early and move logic into manual API
surface code. That usually makes the app harder to evolve, harder to document,
and less representative of the framework.

## Recommended layering

### 1. DTO metadata layer

Start by defining DTOs that describe the public contract you actually want:

- use `@ModelObject()` on DTO/input classes
- use `@ModelField()` to declare:
  - GraphQL field exposure
  - aliases
  - derived fields
  - relation metadata
  - required vs nullable behavior

If the CRUD contract can be expressed here, keep going with generated surfaces.

### 2. Generated API surface

For standard CRUD resources, prefer:

- `CrudGenResourceFactory` when the app owns REST and GraphQL for the resource
- `CrudGenBackendFactory` when a reusable module should expose only the backend
- `CrudGenGraphqlFactory` when an app wants generated GraphQL over an existing backend
- `CrudGenDependencyFactory` for compatibility with older backend + GraphQL packs
- `crudRestControllerFactory` for REST controllers

This should be the default for:

- create
- update
- delete
- get-by-id
- list/grid

### 3. Service override layer

When persistence or write semantics are custom, override the service before you
replace the API surface.

Typical service-level responsibilities:

- input normalization
- storage mapping
- domain validation
- semantic relation synchronization
- event emission / structured errors
- backend-specific behavior hidden behind a CRUD-shaped contract

If the resource is still conceptually CRUD, a custom service is usually enough.

### 4. Repository/query override layer

Introduce a repository or query override when the app needs richer read
semantics than the plain fallback path can provide.

Typical repository-level responsibilities:

- structured filter support
- grid semantics
- relation-aware queries
- projection of derived fields
- backend-specific sorting/pagination behavior

This is the right place to solve “generated grid is not enough yet”.

### 5. Handwritten API surface

Only write custom resolvers/controllers when the API contract itself is no
longer CRUD-shaped.

Typical valid reasons:

- workflow or command endpoints
- orchestration actions
- provider-specific sync triggers
- logging/error demo endpoints
- semantic operations that are not resource CRUD

Do not replace generated CRUD just because the storage backend is custom.

## Decision checklist

Before adding a manual controller or resolver, ask these questions in order:

1. Can the DTO metadata express the contract?
2. Can a service override implement the semantics?
3. Can a repository/query override implement the read behavior?
4. Can `extraArgs`, `extraInputs`, `readonly`, or a custom query solve it?
5. Is a handwritten endpoint still necessary?

If the answer becomes “yes” before step 5, stop there.

## Generated surface vs custom semantics

The intended split is:

- generated surface owns the CRUD contract
- services own domain semantics
- repositories own advanced query behavior
- manual endpoints own non-CRUD behavior

This separation keeps the framework examples coherent and reusable.

## Reusable backend modules

Reusable modules should avoid owning public API surface by default. Prefer this
shape:

- the reusable module registers `CrudGenBackendFactory` providers
- the reusable module optionally keeps `CrudGenDependencyFactory` compatibility
  for existing consumers
- the application imports the backend module and uses `CrudGenResourceFactory`
  or the protocol-specific factories to decide which REST and GraphQL surfaces
  it wants to expose

This keeps GraphQL resolver classes and REST controller classes inside the app
when they are application composition artifacts, while the backend module remains
usable as a substrate for other API shapes.

## Reference examples

- Minimal baseline: [examples/skeleton/app/README.md](../examples/skeleton/app/README.md)
- Reusable substrate example: [examples/omnikernel/app/README.md](../examples/omnikernel/app/README.md)
- Real composition example: [examples/task/app/README.md](../examples/task/app/README.md)
- Factory details: [crud-gen-factory.md](./crud-gen-factory.md)
- Modeling details: [crud-gen-modeling.md](./crud-gen-modeling.md)
- REST details: [crud-gen-rest.md](./crud-gen-rest.md)
