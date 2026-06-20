# @nestjs-yalc/types-extends

Additional ambient type extensions for applications that use the broader
YALC runtime stack.

This package extends `@nestjs-yalc/types` with global declarations for TypeORM
migration registration and selected environment variables.

## Installation

```bash
npm install --save-dev @nestjs-yalc/types-extends
```

## Main Exports

- Re-exports from `@nestjs-yalc/types`.
- Global TypeORM migration class registries.
- Environment variable declarations for logger and TypeORM options.

## Example

```ts
import '@nestjs-yalc/types-extends';

globalThis.TypeORM_Migration_classes = {
  default: [CreateUsersTable],
};
```
