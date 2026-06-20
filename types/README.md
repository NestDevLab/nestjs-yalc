# @nestjs-yalc/types

Shared ambient and utility type definitions for NestJS-YALC packages.

This package is type-only. It provides global utility types and module
declarations used by YALC packages and applications.

## Installation

```bash
npm install --save-dev @nestjs-yalc/types
```

## Main Exports

- `globals.d.ts` with utility types such as `ClassType`, `Exact`, `XOR`,
  `Spread`, and `HTTPMethods`.
- `modules.d.ts` with declarations for packages used by the YALC ecosystem.
- `index.d.ts` re-exporting the type declaration files.

## Example

```ts
import type { ClassType } from '@nestjs-yalc/types/globals.d.js';

function create<T>(cls: ClassType<T>): T {
  return new cls();
}
```
