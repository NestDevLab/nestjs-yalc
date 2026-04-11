# OmniKernel App

Runnable example app that exposes `@nestjs-yalc/omnikernel-module` through both
GraphQL and REST.

## What It Demonstrates

- `OmniKernelModule.register('default')` as the shared provider layer.
- `OmniKernelModule.register('default', { graphql: false })` as a substrate-only
  import.
- GraphQL resolvers and REST controllers composed in the app with
  `CrudGenResourceFactory`.
- Generated API providers and controllers grouped in `OmniApiModule`, while the
  reusable OmniKernel module stays independent from this app's API shape.
- Structured REST `sorting` and `filters` query parameters on generated
  controllers.
- A single in-memory `sqljs` persistence surface where REST and GraphQL operate
  on the same OmniKernel services.

## Exposed REST Resources

- `GET/POST/PUT/DELETE /omni/named`
- `GET/POST/PUT/DELETE /omni/records`
- `GET/POST/PUT/DELETE /omni/documents`
- `GET/POST/PUT/DELETE /omni/collections`
- `GET/POST/PUT/DELETE /omni/relations`
- `GET/POST/PUT/DELETE /omni/external-refs`

REST controllers are generated through `CrudGenResourceFactory`, which delegates
to `crudRestControllerFactory`. They reuse the same OmniKernel services as the
generated GraphQL resolvers.

## Exposed GraphQL

- `/graphql`
- Auto-generated OmniKernel CRUD queries and mutations composed by this app.

The app intentionally owns the API surface. The reusable OmniKernel module
provides the backend services and dataloaders, while this app decides to expose
both generated REST and generated GraphQL.

## Run

```bash
npm run test:e2e --prefix examples/omnikernel-app
```
