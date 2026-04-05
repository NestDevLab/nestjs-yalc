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
If a DTO field is declared as a plain array GraphQL field (for example `@Field(() => [TaskItemType])`), CRUD-Gen now treats it as an array relation and does not force the GraphQL `Connection` wrapper for that field resolver.

Use this when you want:
- `project.tasks: [TaskItemType]`
- `project.events: [TaskEventType]`

instead of a `nodes/pageData` connection shape.

### Practical rule of thumb
If a nested GraphQL relation is requested and the parent object needs a foreign key that the client did not explicitly ask for, prefer declaring `ModelField.relation` correctly instead of writing a custom resolver first. CRUD-Gen is designed to fill in that missing source key automatically when relation metadata is available.
