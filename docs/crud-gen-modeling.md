# CRUD-Gen Modeling Guide (ModelObject / ModelField)

This page explains the two key decorators used by CRUD-Gen to describe how your entity/DTO maps to GraphQL and the datastore.

## ModelObject
- Purpose: attach mapping/filter metadata to a class (entity or DTO).
- Options:
  - `copyFrom`: copy ModelObject/ModelField metadata from another class (useful when using `OmitType`/`PartialType` or separating entities from DTOs).
  - `filters`: include/exclude strategy for mapped fields:
    - `{ type: 'include'|'exclude', fields: string[] }`
- Usage tips:
  - Prefer putting GraphQL-facing decorators on DTOs, not entities; use `copyFrom` to reuse shared mapping.
  - Use `@ObjectType({ isAbstract: true })` on entities when moving GraphQL decorators to DTOs.

## ModelField
- Purpose: describe how a property is exposed in GraphQL and how it maps to the underlying datastore (including joins and dataloader hints).
- Common options:
  - `dst`: datastore column (string) or `{ name, transformerSrc?, transformerDst? }` to customize read/write transforms.
  - `src`: GraphQL field name; defaults to property name or `gqlOptions.name`.
  - `mode`: `'regular'` (default), `'derived'` (expression or virtual column), `'virtual'` (placeholder; not implemented).
  - `gqlType`/`gqlOptions`: forwarded to `@nestjs/graphql` `@Field` metadata (type, description, nullable, etc.).
  - `relation`: declare joins/dataloader mapping:
    - `type`: `() => RelatedClass`
    - `relationType`: TypeORM relation kind
    - `sourceKey` / `targetKey`: `{ dst, alias }` to bind DB and GraphQL field names
    - `defaultValue`: optional defaults for queries
  - Filtering controls: use `ModelObject.filters` to include/exclude mapped fields from generated filters.
- Usage tips:
  - Let TypeORM decorators drive basic mapping; add `@ModelField` when you need GraphQL overrides, aliases, joins, or derived columns.
  - For relations, keep `sourceKey`/`targetKey` aligned with the database columns and GraphQL names to avoid join/dataloader mismatches.
  - Derived fields (`mode: 'derived'`) should set `dst` to the SQL/expression you expect to select.

## Patterns
- Entities vs DTOs: keep persistence concerns on entities and GraphQL-facing shape on DTOs; use `copyFrom` to avoid duplication.
- Hidden data: prefer `HideField` (from `@nestjs/graphql`) on DTOs for sensitive columns and keep the entity mapped for persistence.
- Relations: if a relation is already described via TypeORM decorators, only add `ModelField` when you need custom aliases or defaults.

## Relation metadata: important hidden behavior
CRUD-Gen can do more with `ModelField.relation` than just influence joins. When relation metadata is present on DTO fields, the GraphQL layer uses it to:
- build/override nested field resolvers
- map the correct dataloader lookup keys via `sourceKey` / `targetKey`
- auto-select the source foreign key required to resolve nested relations such as `task.project`

This means relation metadata should be considered part of the GraphQL execution contract, not just a repository hint.

### Recommended pattern for DTO relations
Use:
- `gqlType` for the GraphQL DTO/object type you want to expose
- `relation.type` for the underlying entity/dataloader type used by CRUD-Gen internally

Example:

```ts
@ModelField({
  gqlType: returnValue(TaskProjectType),
  gqlOptions: { nullable: true },
  relation: {
    relationType: 'many-to-one',
    sourceKey: { dst: 'projectId', alias: 'projectId' },
    targetKey: { dst: 'guid', alias: 'guid' },
    type: returnValue(TaskProject),
  },
})
@Field(() => TaskProjectType, { nullable: true })
project?: TaskProjectType | null;
```

### One-to-many arrays vs connection objects
If a DTO field is declared as a plain array GraphQL field (for example `@Field(() => [TaskItemType])`), CRUD-Gen treats that relation field as an array relation and does not wrap it in the GraphQL `Connection` shape.

Use this when you want:
- `project.tasks: [TaskItemType]`
- `project.events: [TaskEventType]`

instead of a `nodes/pageData` connection shape.

By contrast, top-level generated grid queries still return connection-style wrappers.

### Practical rule of thumb
If a nested GraphQL relation is requested and the parent object needs a foreign key that the client did not explicitly ask for, prefer declaring `ModelField.relation` correctly instead of writing a custom resolver first. CRUD-Gen is designed to fill in that missing source key automatically when relation metadata is available.

## GraphQL grid args: sorting, filters, pagination
For generated GraphQL grid queries, the public args contract includes:
- `sorting`
- `filters`
- `startRow`
- `endRow`

Notes:
- For generated GraphQL grid queries, `filters` uses the generated GraphQL DTO-specific input type (for example `TaskItemTypeFilterExpressionInput`), not the legacy raw `FilterScalar` name.
- The filter model is built around `expressions` / `childExpressions`, with typed branches such as `text`, `number`, `date`, and `set`.
- `field` and `sorting.colId` are runtime strings in the schema; do not assume enum validation at the GraphQL schema layer.
- `startRow` and `endRow` are real GraphQL args on paginated grid queries and drive the `pageData.startRow/endRow` response metadata.
- If these pagination args are missing from the schema, treat that as a framework regression rather than an application-level limitation.
- Count behavior is selection-sensitive: selecting `pageData.count` can trigger a different repository path than queries that only ask for `nodes`.
- Advanced structured filtering (`filters` with `expressions` / `childExpressions`) requires the extended repository path. When CRUD-Gen falls back to a plain TypeORM repository, these extended query features now fail explicitly instead of being ignored silently.

## Plain fallback vs extended repository
CRUD-Gen has two execution modes at runtime:

### Plain TypeORM fallback
Use this when only standard repository methods are available (`find`, `findAndCount`, etc.).

Supported reliably:
- simple `where`
- sorting
- pagination
- basic GraphQL grid queries
- linkage fields such as `projectId`

Not supported as full CRUD-Gen semantics:
- structured GraphQL filters
- advanced join/subquery behavior
- dataloader/relation-loading flows that depend on extended repository semantics
- richer helper metadata encoded in `where.filters`

### Extended repository path
Use this when the repository exposes the CRUD-Gen extended helpers.

Required for:
- structured GraphQL filters
- advanced query semantics (`where.filters`, subqueries, advanced joins)
- full richer CRUD-Gen behavior beyond plain TypeORM find/findAndCount

Rule of thumb:
- if a feature needs CRUD-Gen-specific query semantics, treat it as **extended-repository-only**
- do not re-implement those semantics in the plain fallback unless you intentionally want to duplicate the extended repository engine
