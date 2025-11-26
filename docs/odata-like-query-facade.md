# OData-like Query Façade (REST)

This document defines a shared, OData-inspired query surface that REST endpoints can adopt consistently across applications built with `nestjs-yalc`. It is intentionally narrower than full OData v4, but stable enough to be exposed to external clients (including AI/automation agents).

The façade is expressed via query parameters:

- `$select` — projection
- `$filter` — boolean filter expressions
- `$orderby` — sorting
- `$top` / `$skip` — pagination
- `$count` — total count toggle
- `$expand` — optional expansions/joins

Implementations are free to ignore features they do not support, but **must fail fast with HTTP 400** for syntactically invalid parameters or unknown fields/expansions.

## `$select` — projection

Purpose: restrict the fields returned for each node.

- Type: comma-separated list of field names.
- Example:
  - `? $select=id,name,createdAt`
- Behaviour:
  - If omitted, the resource-specific default projection applies.
  - If a requested field is not allowed for the resource, the server **MUST** return `400 Bad Request`.
  - Implementations may maintain an allow‑list per resource to enforce security/performance constraints.

## `$filter` — filter expressions

Purpose: restrict the result set by boolean predicates.

Syntax (intentionally small, OData-inspired):

- Comparison operators:
  - `eq`, `ne`, `gt`, `ge`, `lt`, `le`
- Logical operators:
  - `and`, `or`, `not`
- String operators:
  - `contains(field,'substr')`
  - `startswith(field,'prefix')`
  - `endswith(field,'suffix')`
- Set operator:
  - `in` as infix: `status in ('active','pending')`

Type handling:

- Strings are single-quoted: `'text'`.
- Numbers are unquoted: `42`, `3.14`.
- Booleans are unquoted: `true`, `false`.
- Dates/instants should be ISO‑8601 strings: `'2024-01-31T23:59:59Z'`.

Examples:

- `? $filter=has_blocking_issues eq true`
- `? $filter=price gt 10 and (category eq 'Coffee' or category eq 'Tea')`
- `? $filter=contains(name,'espresso') and status in ('active','pending')`

Error handling:

- If the expression cannot be parsed, or uses unknown fields/operators, the server **MUST** return `400 Bad Request` with a validation error payload.

## `$orderby` — sorting

Purpose: specify sort order for the result set.

- Type: comma-separated list of `field [asc|desc]` segments.
- Defaults:
  - When `asc|desc` is omitted, `asc` is assumed.
- Examples:
  - `? $orderby=price desc`
  - `? $orderby=category asc,price desc`
- Null handling:
  - Implementations may choose default null ordering (e.g., `NULLS LAST`); if exposed externally, document per endpoint.
- Error handling:
  - If a field is not sortable or does not exist, return `400 Bad Request`.

## `$top` / `$skip` — pagination

Purpose: limit and offset the result set.

- `$top`: maximum number of records to return.
- `$skip`: number of records to skip from the start.
- Examples:
  - `? $top=50`
  - `? $top=50&$skip=100`
- Validation:
  - `$top` **MUST** be a positive integer (`>= 1`).
  - `$skip` **MUST** be a non‑negative integer (`>= 0`).
  - Implementations may enforce a maximum `$top` (e.g., 100 or 1000); exceeding the limit should return `400 Bad Request`.

## `$count` — total count toggle

Purpose: request the total number of matching records in addition to the current page.

- Values:
  - `true` — include total count.
  - Omitted or `false` — do not compute/return the count.
- Example:
  - `? $top=50&$skip=0&$count=true`

Response shape (recommended baseline):

```jsonc
{
  "data": [ /* nodes */ ],
  "pageInfo": {
    "top": 50,
    "skip": 0,
    "hasMore": true,
    "count": 123 // only present when $count=true
  },
  "meta": { /* optional metadata, including warnings */ },
  "context": {
    "resource": "things",
    "generatedAt": "2025-01-01T12:00:00Z"
  }
}
```

- `data` is the current page of nodes.
- `pageInfo.top`/`pageInfo.skip` echo the applied pagination window.
- `pageInfo.hasMore` indicates whether additional pages exist.
- `pageInfo.count` is only present when `$count=true` was requested.
- `context` is optional and can carry resource-specific metadata (e.g., API v2 contexts).

## `$expand` — expansions / joins

Purpose: request optional related data or server‑side aggregations.

- Type: comma-separated list of expansion identifiers understood by the resource.
- Example:
  - `? $expand=constraints,lastSelections,pricing`
- Semantics:
  - `$top/$skip` apply only to the root collection (`items`).
  - Expanded payloads are computed **for the selected root items**; there is no nested pagination on expansions.
- Validation:
  - Each resource maintains an allowed expansions list.
  - Unknown or disabled expansions **MUST** result in `400 Bad Request`.

Example combined query:

```http
GET /api/things?$select=id,name&$filter=status eq 'active'&$orderby=createdAt desc&$top=50&$skip=0&$count=true&$expand=details,owner
```

## Error model (high-level)

This façade does not impose a concrete error payload, but implementations should:

- Use HTTP `400 Bad Request` for:
  - malformed `$filter`/`$orderby`/`$select`/`$expand`
  - unknown fields/expansions
  - invalid values for `$top/$skip/$count`
- Include a machine‑readable code and human‑readable message in the response body, following the host application’s error conventions (e.g., `@nestjs-yalc/event-manager`).

## Metadata and partial failures

When endpoints perform aggregations or expansions that may fail independently (e.g., pricing suggestions timing out), they should:

- Always return whatever data is available for the root resource.
- Surface non‑fatal issues under `meta.warnings`:

```jsonc
{
  "data": [ /* nodes */ ],
  "pageInfo": {
    "top": 50,
    "skip": 0,
    "hasMore": false,
    "count": 123
  },
  "meta": {
    "warnings": [
      { "source": "pricing", "code": "TIMEOUT" }
    ]
  }
}
```

This pattern lets clients (including AI agents) detect incomplete joins without special‑casing each endpoint.
