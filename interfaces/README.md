# @nestjs-yalc/interfaces

Shared TypeScript interfaces and utility types used across YALC packages.

Use this package when an application or library needs the common YALC shapes
without importing heavier runtime packages.

## Installation

```bash
npm install @nestjs-yalc/interfaces
```

## Main Exports

- `IPagingParams` for paging/query parameter contracts.
- Field mapper types and guards.
- NestJS helper types such as `ImportType` and decorator type aliases.

## Example

```ts
import type { IPagingParams } from '@nestjs-yalc/interfaces';

function normalizePaging(params: IPagingParams) {
  return {
    skip: params.skip ?? 0,
    take: params.take ?? 25,
  };
}
```
