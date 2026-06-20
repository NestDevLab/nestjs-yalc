# @nestjs-yalc/data-loader

NestJS DataLoader helpers for batching entity lookups and exposing injectable
loader providers.

Use this package directly when you need the YALC dataloader primitive without
the higher-level CrudGen resource factory.

## Installation

```bash
npm install @nestjs-yalc/data-loader
```

## Main Exports

- `GQLDataLoader` for request-scoped entity batching.
- `DataLoaderFactory` for creating Nest providers around a repository-backed
  loader.
- `getDataloaderToken` for deriving the provider token used by generated
  modules.
- `SearchKeyType` and helper functions for selecting lookup keys.

## Example

```ts
import { DataLoaderFactory } from '@nestjs-yalc/data-loader';

export const userDataloaderProvider = DataLoaderFactory('id', UserEntity);
```

## Documentation

CrudGen uses this package internally for generated GraphQL dataloaders:
https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/crud-gen-factory.md
