# CrudGen scoped JSON projections

CrudGen projections provide generated REST and GraphQL CRUD for a resource that
has server-owned scope, a revision, physical columns, and a JSON payload. They
are designed for the common case where a resource begins with a small set of
indexed fields while other public fields live at portable JSON object paths.

The application supplies a TypeORM repository and a trusted `ProjectionScope`.
It declares each JSON path once in projection metadata; it does not repeat
those paths in CRUD methods or supply dialect-specific SQL.

## One declaration

Import the public API from `@nestjs-yalc/crud-gen` and define the resource once:

```ts
import { defineProjectionResource } from '@nestjs-yalc/crud-gen';

export const workItemProjection = defineProjectionResource({
  id: 'sample.work-item.v1',
  tableName: 'sample_work_item',
  identity: { column: 'guid', uniqueWithinScope: true },
  scope: { column: 'scopeId', serverOwned: true },
  revision: { column: 'revision' },
  payload: { column: 'payload', allowCreate: true },
  deletion: 'hard',
  fields: [
    {
      name: 'guid',
      storage: 'column',
      column: 'guid',
      codec: 'string',
      nullable: false,
      requiredOnCreate: true,
      query: { filter: ['eq'], sort: true },
    },
    {
      name: 'priority',
      storage: 'json',
      path: ['workflow', 'priority'],
      codec: 'integer',
      nullable: true,
      query: { filter: ['eq', 'range'], sort: true },
      index: { name: 'sample_work_item_priority_idx' },
    },
  ],
});
```

The immutable declaration is the single source for generated DTO fields,
GraphQL types, TypeORM schema options, query and sort capabilities, expression
indexes, projection and promotion metadata. Use
`createProjectionGraphqlTypes`, `createProjectionSchemaOptions`,
`ProjectionResourceService`, and `createProjectionDialect` with that same
value. Do not duplicate paths or SQL in an application service.

In this narrow contract, the physical payload column is always named `payload`.
That deliberate restriction keeps the public REST/GraphQL field, generated
schema, and persistence field identical.

The scope is supplied by the server through a trusted `ProjectionScope` and is
never a public create, update, condition, REST, or GraphQL field. The identity
must be a required, non-null `string` or `uuid` physical column and is unique
inside the scope. Every other non-null field must also be required on create
because this contract has no implicit default-value mechanism. A resource
supports hard delete only.

## Public CRUD semantics

Generated REST keeps its existing `PUT` update route; this contract does not
add a global `PATCH` alias. GraphQL uses the generated update input. Both call
the same service and therefore have the same behavior:

- Create writes `revision = 1` and uses the trusted scope.
  A duplicate identity in the same scope is an explicit conflict; the same
  identity remains valid in a different scope.
- Update requires `expectedRevision` between `1` and `2147483646` and at
  least one declared projected field. The identity is available only in output,
  create input, and conditions: generated REST and GraphQL update inputs omit
  it, and direct update input that supplies it fails closed. The update
  atomically matches scope, identity, and revision; a matching row gets
  `revision + 1`. A missing row is not found, while a present row with a
  different revision is an explicit optimistic-concurrency conflict.
- A JSON projected update changes only its declared path and preserves sibling
  keys in the payload.
- `payload` is readable output. When `payload.allowCreate` is true, a JSON
  object may seed a create request. Raw payload replacement is never writable
  during update; there is no `allowPatch` mode.
- A nullable projected field may be set to `null`. Missing JSON paths read as
  `null` for nullable fields. Non-null fields reject `null`.

The raw payload must be a JSON-compatible object; `Date`, `undefined`, cycles,
functions, and other non-JSON values are rejected before persistence. A create
request may not supply a declared projected JSON path both inside raw `payload`
and as its typed projected field: that ambiguous dual source fails closed.
Raw JSON projected fields are transport-only: they can be created and updated
as values but cannot be filtered, sorted, or indexed.

## Supported fields and queries

`string`, `uuid`, `integer`, and `instant` fields have the same validation and
query operators on SQLite and PostgreSQL. `uuid` accepts only the canonical
lowercase, hyphenated UUID text form. Generated GraphQL object, create, patch,
and condition fields use `UUIDScalar`; REST/service input, filters, and
identity conditions reject invalid UUIDs before persistence or SQL. UUID values
are stored and queried as validated text, so equality filters, sorting, and
expression indexes work for both physical columns and JSON projections exactly
as they do for strings. UUID range filtering is intentionally not supported.
`integer` is a signed 32-bit value
(`-2147483648` through `2147483647`), matching GraphQL `Int` and PostgreSQL
`integer`. The upper revision value is reserved as the terminal revision so an
update can never overflow that portable range.
`instant` accepts canonical UTC ISO strings and normalizes a JavaScript `Date`
to that string. String equality is supported; string range is intentionally
not supported. Integer and instant equality/range filters, sorting, and
expression indexes use a typed dialect expression consistently.

Declare `query.filter` and `query.sort` per field. The service accepts only
those capabilities. Unsupported fields, unknown fields, null filters, bad
range arity, raw JSON queries, and unsupported operators fail closed before a
query is run. The identity also accepts an `IN` filter for generated list
lookups. Structured GraphQL filters support an `AND`-only expression tree;
`OR` fails closed because it cannot be represented by the projection dialect's
conjunctive query contract. Pagination has
deterministic identity ordering as a final tie-breaker.

JSON paths are object-property paths only. Every segment must match
`[A-Za-z_][A-Za-z0-9_]*`; arrays and special JSON-path syntax are deliberately
not portable projection paths. Metadata validation also rejects duplicate
fields/indexes/columns, reserved public or storage collisions, overlapping JSON
paths, invalid required/nullability combinations, and modes the runtime cannot
honor.

## SQLite and PostgreSQL

SQLite uses JSON1 and a `simple-json` payload column. PostgreSQL uses `jsonb`.
The dialect owns all JSON extraction, JSON mutation, typed casts, index
expressions, inspection, and explain-plan probes. Application code must not
emit JSON SQL or dialect conditionals.

Deep projected updates create missing JSON object ancestors on both dialects.
Existing object ancestors retain their sibling keys; a missing or non-object
ancestor is normalized to an object only where the declared path requires it.

The public contract is intentionally narrower than either database: paths are
portable object paths and query semantics are the same. Database-specific
storage details can therefore remain behind `ProjectionDialect`.

## Schema and indexes

`createProjectionSchemaOptions(definition, dialect)` creates the TypeORM column
and scoped-identity schema options. To prepare a reviewed migration, compile
the deterministic expression-index statements:

```ts
const dialect = createProjectionDialect('postgres');
const statements = dialect.compileIndexStatements(workItemProjection);
// Place `statements` in a reviewed application migration.
```

`applyProjectionIndexesForBootstrap(dataSource, dialect, definition)` executes
those statements only for an isolated bootstrap or test database. It is not a
production schema-migration mechanism and applications must not synchronize
projection DDL at request time.

## Promotion policy

When a JSON field needs a physical column, keep its public field name and codec
and change its storage declaration from `json` plus `path` to `column` plus
`column`. Ship the storage change with a reviewed migration that backfills and
verifies values before removing the JSON copy. This framework does not perform
backfills, dual reads, or runtime schema mutation. Plan an explicit
compatibility window if existing payload consumers rely on the old path.

## Runnable verification

Run the synthetic projection suite with SQLite:

```bash
npm run test:e2e --prefix examples/omnikernel/app -- --runInBand \
  --runTestsByPath apps/omnikernel-app/test/projection-spike.e2e-spec.ts
```

For PostgreSQL 16, use a disposable loopback-only database and clean it up
when the test ends. This shell example chooses a random host port and leaves
no persistent container:

```bash
port=$(shuf -i 20000-40000 -n 1)
container=$(docker run -d --rm -p 127.0.0.1:${port}:5432 \
  -e POSTGRES_PASSWORD=projection-test postgres:16)
trap 'docker stop "$container" >/dev/null' EXIT
until docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
PROJECTION_SPIKE_DIALECT=postgres \
PROJECTION_SPIKE_POSTGRES_URL="postgres://postgres:projection-test@127.0.0.1:${port}/postgres" \
npm run test:e2e --prefix examples/omnikernel/app -- --runInBand \
  --runTestsByPath apps/omnikernel-app/test/projection-spike.e2e-spec.ts
```

The suite covers REST and GraphQL parity, typed filtering/sorting, raw-payload
write boundaries, deep-ancestor creation and sibling preservation, revision
conflicts, scope isolation, index inspection, and explain-plan evidence on both
dialects.

## Limitations

- There is no raw payload update API, global PATCH alias, tombstone mode, or
  runtime migration framework.
- JSON arrays are valid values for a projected `json` field, but raw `payload`
  itself must be an object and projection paths do not address array elements.
- Raw JSON values are not filterable, sortable, or indexable.
- The application still owns authentication and creates the trusted scope
  adapter; projection metadata does not authenticate callers.
- Locale-sensitive string ordering follows the configured database collation;
  applications that require byte-identical cross-database ordering must choose
  equivalent SQLite and PostgreSQL collations in their schema/migrations.
- Generic relation semantics are not part of this projection contract; the
  synthetic OmniKernel verification app keeps its relation fixture local until
  a separate relation contract is formalized.
