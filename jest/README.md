# @nestjs-yalc/jest

Jest helpers for YALC and NestJS test suites.

Use this package for common mocks, ESM-aware GraphQL mocking, environment test
helpers, query builder mocks, and shared assertions.

## Installation

```bash
npm install --save-dev @nestjs-yalc/jest
```

## Main Exports

- `envTestHelper` for temporary environment variable overrides.
- `createNestJsGraphqlMock` and `mockNestJSGraphql` for Nest GraphQL tests.
- `mockedExecutionContext`, `mockChainingObject`, and `mockQueryBuilder`.
- Common class/factory definition tests and ESM import helpers through
  subpaths.

## Example

```ts
import { envTestHelper } from '@nestjs-yalc/jest';

const env = envTestHelper({ NODE_ENV: 'test' });

try {
  // test code
} finally {
  env.reset();
}
```

## Related Package

Use `@nestjs-yalc/jest-config` when you need the generated Jest configuration
helpers used by the monorepo.
