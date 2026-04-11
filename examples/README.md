# Examples

The examples are organized by architectural role.

## Skeleton

`examples/skeleton` is the smallest complete path:

- `module`: simple DTO/entity/service package.
- `app`: generated REST + GraphQL + backend composition with
  `CrudGenResourceFactory`.

Use it as the baseline for a new app.

## OmniKernel

`examples/omnikernel` separates reusable backend from API exposure:

- `module`: backend-only OmniKernel substrate.
- `app`: generated REST + GraphQL APIs composed over that substrate.

Use it as the reference for reusable CrudGen-compatible persistence backends.

## Task

`examples/task` is the advanced real-world composition:

- `module`: task domain DTO/entity package.
- `app`: OmniKernel-backed runtime with generated REST/GraphQL and targeted
  service/dataloader overrides.

Use it to study customization patterns without falling back to manual CRUD
controllers or resolvers.
