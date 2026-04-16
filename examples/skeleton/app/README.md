# Skeleton App

This is the minimal runnable CrudGen example. It shows the standard path for a
small SQLite in-memory Nest app:

- model entities and DTOs in `examples/skeleton/module`
- compose REST, GraphQL, service, repository, and dataloader providers in the
  app with `CrudGenResourceFactory`
- keep manual controllers only for non-CRUD framework examples such as
  `EventManager`, logging, validation, and `ApiStrategy`

The CRUD resources are intentionally app-owned:

- `apps/skeleton-app/src/users/users.resource.ts`
- `apps/skeleton-app/src/phones/phones.resource.ts`

Those files are the copyable baseline for a new application. They expose both
generated REST and generated GraphQL over the same service/repository layer.

## What It Demonstrates

- Generated REST controllers for `/users` and `/phones`.
- Generated GraphQL CRUD and grid operations with the `SkeletonModule_` prefix.
- A service override for users to show how an app can customize the backend
  provider while keeping generated APIs.
- `extraArgs`, `extraArgsStrategy`, and `extraInputs` on generated GraphQL.
- Event-aware error handling, logging, DTO validation, and HTTP/local
  `ApiStrategy` calls as separate non-CRUD examples.

## API Strategy Client Pattern

The skeleton module exports a small typed client:

```text
controller -> module API client -> selected API strategy
```

`UsersApiClient` lives in `examples/skeleton/module/src/client` and wraps the
generated `/users` and `/phones` REST endpoints. The app wires local and HTTP
strategies in `UsersModule`, then exposes the selected client through:

- `GET /users-client`
- `GET /users-client/phones`

This app remains intentionally minimal, so the client controller is a low-level
framework example rather than a full workflow layer. The skeleton Express
runtime uses the HTTP strategy by default; the e2e suite also starts a Fastify
app and switches `USERS_API_STRATEGY=local` to verify `NestLocalCallStrategy`.

## Run

```bash
npm run test:e2e --prefix examples/skeleton/app
```

## Role In The Examples

Use this app when you want the smallest complete example of "generate the whole
resource from one composition point".
