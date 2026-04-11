# Examples

The examples are organized as three progressively richer applications. They are
not three competing starters; each one exists to demonstrate a different layer
of the framework.

## Skeleton

`examples/skeleton` is the smallest complete path:

- `module`: simple DTO/entity/service package.
- `app`: generated REST + GraphQL + backend composition with
  `CrudGenResourceFactory`.

Use it as the baseline for a new app. It shows the standard CrudGen path plus
small, separate examples for validation, `YalcEventService`, and `ApiStrategy`.
See [`examples/skeleton/README.md`](./skeleton/README.md) and
[`examples/skeleton/app/README.md`](./skeleton/app/README.md) for details.

## OmniKernel

`examples/omnikernel` separates reusable backend from API exposure:

- `module`: backend-only OmniKernel substrate.
- `app`: generated REST + GraphQL APIs composed over that substrate.

Use it as the reference for reusable CrudGen-compatible persistence backends.
Its focus is backend/API separation, not custom service-to-service flows. See
[`examples/omnikernel/README.md`](./omnikernel/README.md),
[`examples/omnikernel/module/README.md`](./omnikernel/module/README.md), and
[`examples/omnikernel/app/README.md`](./omnikernel/app/README.md) for details.

## Task

`examples/task` is the advanced real-world composition:

- `module`: task domain DTO/entity package.
- `app`: OmniKernel-backed runtime with generated REST/GraphQL and targeted
  service/dataloader overrides.

Use it to study customization patterns without falling back to manual CRUD
controllers or resolvers. It is also the main example for using
`YalcEventService` and `ApiStrategy` beside generated CRUD surfaces. See
[`examples/task/README.md`](./task/README.md) and
[`examples/task/app/README.md`](./task/app/README.md) for details.
