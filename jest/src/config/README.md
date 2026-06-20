# @nestjs-yalc/jest-config

Reusable Jest configuration generators for YALC-style TypeScript and NestJS
projects.

Use this package when a consuming workspace wants the same ts-jest defaults,
coverage threshold handling, GraphQL AST transformer, and project generation
used by the YALC monorepo.

## Installation

```bash
npm install --save-dev @nestjs-yalc/jest-config
```

## Main Exports

- `jestConfGenerator` for creating multi-project Jest configs.
- `createE2EConfig` for e2e Jest configuration.
- `tsJestConfig` and `tsJestConfigE2E` for ts-jest setup.
- `coverageThreshold`, `coveragePathIgnorePatterns`, and default globals.

## Example

```ts
import { jestConfGenerator } from '@nestjs-yalc/jest-config';

export default jestConfGenerator(rootPath, projects, appProjects, {
  skipProjects: ['types'],
});
```
