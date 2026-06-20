# @nestjs-yalc/graphql

GraphQL helpers used by YALC applications.

The public entry point currently exports the Sofa middleware builder for
exposing GraphQL resolvers through REST-style routes. Additional GraphQL helper
modules are available through package subpaths.

## Installation

```bash
npm install @nestjs-yalc/graphql
```

## Main Exports

- `buildSofaMiddleware` for creating Sofa API middleware from a GraphQL schema.

## Subpath Helpers

The package also ships GraphQL utilities under `src` subpaths, including:

- request decorators,
- UUID scalar helpers,
- GraphQL error helpers,
- AST and complexity helpers.

## Example

```ts
import { buildSofaMiddleware } from '@nestjs-yalc/graphql';

const middleware = buildSofaMiddleware(schema, {
  basePath: '/api',
});
```

## Documentation

- GraphQL CRUD guide:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/api-creation.md
- REST through CrudGen and Sofa:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/crud-gen-rest.md
