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
