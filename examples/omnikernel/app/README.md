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
- Server-owned Omni scope propagated through generated CRUD, repositories, and
  GraphQL dataloaders. The normal example uses the configured `default` scope;
  a production app should supply an authenticated scope resolver.
- Scoped uniqueness, composite relation indexes, payload schema/revision
  metadata, and the documented hard-delete/tombstone lifecycle policy.

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

### OmniKernel B2 dialect verification

`apps/omnikernel-app/test/omnikernel-b2.e2e-spec.ts` is a test-only app that
uses a simple bearer-token fixture to exercise two trusted server scopes. It is
not production authentication. The suite proves generated REST and GraphQL
CRUD parity, cross-scope negative cases, relation dataloader isolation, raw
JSON validation, and bounded `EXPLAIN` evidence for SQLite and PostgreSQL.

Run SQLite (the default):

```bash
OMNIKERNEL_B2_DIALECT=sqlite npm run test:e2e --prefix examples/omnikernel/app -- --runInBand --runTestsByPath apps/omnikernel-app/test/omnikernel-b2.e2e-spec.ts
```

For PostgreSQL, provide a disposable loopback-only PostgreSQL 16 instance and
set `OMNIKERNEL_B2_DIALECT=postgres` plus `OMNIKERNEL_B2_POSTGRES_URL`. This
bounded fixture checks index selection at a small diagnostic volume; it is not
a production capacity benchmark.

### Isolated projection contract verification

`apps/omnikernel-app/src/projection-spike` is a synthetic, test-only consumer
of the CrudGen scoped JSON projection contract. It is not exposed by the normal
Omni app. Its e2e suite proves generated REST and GraphQL parity, server-owned
scope, scoped relations, create-only raw payload transport, sibling-preserving
revision patches, explicit hard delete, deterministic pagination, and dialect
indexes. It also runs the same integer and canonical-instant filter/sort
semantics against SQLite JSON1 and PostgreSQL `jsonb`, including invalid-value
and invalid-path rejection. Public contract and migration guidance live in
[Scoped JSON projections](../../../docs/crud-gen-projections.md).
The relation service used by this test app is deliberately app-local: it is a
scope-isolation fixture, not a prematurely exported generic relation API.

Run SQLite (the default):

```bash
npm run test:e2e --prefix examples/omnikernel/app -- --runInBand --runTestsByPath apps/omnikernel-app/test/projection-spike.e2e-spec.ts
```

The PostgreSQL run requires a disposable loopback-only PostgreSQL 16 instance
and sets `PROJECTION_SPIKE_DIALECT=postgres` plus
`PROJECTION_SPIKE_POSTGRES_URL`; its payload column is native `jsonb`.

## Role In The Examples

Use this app when you want to see how a reusable backend/substrate can stay
protocol-free while a consuming app decides which REST and GraphQL APIs to
publish.
