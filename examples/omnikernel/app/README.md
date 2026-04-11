# OmniKernel App

Runnable example app that exposes the reusable OmniKernel backend through
generated REST and GraphQL APIs.

The app owns the API surface. `examples/omnikernel/module` provides the
backend substrate, while this app composes protocol-specific APIs in
`apps/omnikernel-app/src/omni/omni-api.resources.ts` with
`CrudGenResourceFactory`.

## What It Demonstrates

- Backend-only module import via `OmniKernelModule.register('default')`.
- Generated REST and GraphQL for the same OmniKernel services.
- App-local composition of all public API resources.
- Structured REST `sorting` and `filters` query parameters on generated
  controllers.
- A single SQLite in-memory persistence surface shared by REST and GraphQL.

## Exposed REST Resources

- `GET/POST/PUT/DELETE /omni/named`
- `GET/POST/PUT/DELETE /omni/records`
- `GET/POST/PUT/DELETE /omni/documents`
- `GET/POST/PUT/DELETE /omni/collections`
- `GET/POST/PUT/DELETE /omni/relations`
- `GET/POST/PUT/DELETE /omni/external-refs`

## Exposed GraphQL

- `/graphql`
- Auto-generated OmniKernel CRUD queries, mutations, and grid queries.

## Run

```bash
npm run test:e2e --prefix examples/omnikernel/app
```

## Role In The Examples

Use this app when you want to see how a reusable backend/substrate can stay
protocol-free while a consuming app decides which REST and GraphQL APIs to
publish.
