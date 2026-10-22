# GraphQL input compatibility and rejection layers

## Canonical entity-aware inputs

Pass the decorated entity or API model to `sortModelFactory(Model)`,
`filterExpressionInputFactory(Model)`, `crudGenParamsFactory(defaults, Model)`
and `crudGenParamsNoPaginationFactory(defaults, Model)`. Generated resolvers
already supply their selected API/entity model; join inputs pass the related
model. The model's mapped properties remain the single source of truth for the
GraphQL field enum. This change does not widen that schema.

```ts
import { sortModelFactory, filterExpressionInputFactory } from
  '@nestjs-yalc/crud-gen/api-graphql/crud-gen.input.js';
import { crudGenParamsFactory } from '@nestjs-yalc/crud-gen/crud-gen.args.js';

const UserSort = sortModelFactory(UserType);
const UserFilters = filterExpressionInputFactory(UserType);
const UserArgs = crudGenParamsFactory(undefined, UserType);
const sorting = new UserSort();
sorting.colId = 'name'; // must be a key of UserType
const filters = new UserFilters();
filters.childExpressions = []; // recursively preserves UserType field keys
```

Factory return types now retain entity keys through cached results and recursive
filter expressions. Existing broad interfaces remain available for generic
service code; default-value arguments and dynamic extra parameters keep their
compatibility typing. TypeScript keys are only an upper bound: undecorated properties,
metadata aliases, hidden or derived fields may differ from the schema. Runtime
metadata cannot manufacture a TypeScript enum or prove that a decorated field
supports a repository operation. Use the emitted schema for client generation
and validate operations against it. Runtime field decorators still use the
metadata-generated enum, including text, number, date and set filters.

## Retained compatibility APIs and consumer inventory

| Surface | Repository consumers | Decision |
| --- | --- | --- |
| `SortModel` (`colId: string`) | Model-less args factories and input tests | Exported deprecated class retained; prefer `sortModelFactory(Model)` |
| Model-less args factories | Args tests; custom `CrudGenArgs` / `CrudGenArgsNoPagination` calls can omit `entityType` | Retained compatibility overloads; prefer supplying a model |
| Entity-aware args factories | Generated resolver decorators, related-model join inputs, args tests | Canonical route |
| `FilterScalar` | Model-less args factories and scalar tests | Retained legacy JSON-string normalization route |

This inventory covers checked-in source, not external applications. No public
export or compatibility overload is removed. There is no scheduled removal;
removing these paths needs a separately announced breaking release and external
consumer assessment. A migration can change the public GraphQL input types, so
regenerate clients and migrate callers together.

For a custom decorator, migrate `CrudGenArgs({ ...options })` to
`CrudGenArgs({ ...options, entityType: UserType })`. For direct factories, migrate
`crudGenParamsFactory(defaults)` to `crudGenParamsFactory(defaults, UserType)`
(and likewise for the no-pagination variant).

A legacy scalar variable is a **JSON string** containing a field-keyed filter
map, for example:

```json
{"filters":"{\"name\":{\"filterType\":\"text\",\"type\":\"contains\",\"filter\":\"Ada\"}}"}
```

The equivalent entity-aware variable uses the generated input object:

```json
{"filters":{"expressions":[{"text":{"field":"name","type":"CONTAINS","filter":"Ada"}}]}}
```

The legacy scalar normalizes recognized field-keyed filters to expressions; it
has no entity enum allowlist. It is not an arbitrary JSON-object scalar:
non-string variable values currently normalize from an empty object; non-string
literals are rejected. Malformed JSON fails parsing, and unrecognized entries
may be ignored. Do not use it as field authorization or expect equivalent schema
validation. Migrating only the TypeScript type does not migrate wire payloads.
Both routes still depend on service/repository capabilities after coercion.

## Rejection policy

Request validation/coercion and resolver execution are separate contracts. The
skeleton configures Nest's Apollo driver with Apollo Server 5 and default error
formatting. Its SQLite GraphQL regressions pin these observations:

| Fixture | Layer | HTTP | Error contract |
| --- | --- | --- | --- |
| Unknown inline `sorting.colId` enum | Document validation | 400 | `GRAPHQL_VALIDATION_FAILED`, no data or execution path |
| Unknown variable filter field enum | Variable coercion | 400 | `BAD_USER_INPUT`, no data or execution path |
| Valid `firstName` filter with a plain repository | Resolver capability rejection | 200 | `INTERNAL_SERVER_ERROR`, null data, grid execution path and capability message |
| Missing required extra arguments | Resolver argument policy | 200 | `BAD_REQUEST`, null data, grid execution path and required-arguments message |

A field omitted by schema metadata is not proof of repository rejection. The
capability fixture therefore uses a schema-valid field, and unknown enum fixtures
use a deliberately nonexistent key. These tests exercise different layers and
must not accept alternate reasons or `[200, 400]` status ranges.

Other drivers, Apollo versions, content negotiation or explicitly configured
error formatters can select different statuses and extension codes. GraphQL
execution errors may accompany HTTP 200; validation/coercion need not share that
status. Pin each supported configuration independently, preserving errors/no
successful data and the intended rejection layer. Do not normalize all failures
to HTTP 400 or change production exception handling to satisfy a test.

The schema regression builds real Nest GraphQL metadata for both factory modes.
The type regression invokes TypeScript diagnostics directly against positive
and `@ts-expect-error` cases, independent of ts-jest's disabled diagnostics.
