# @nestjs-yalc/field-middleware

Field parsing, transformation, and validation helpers for DTOs, GraphQL fields,
and TypeORM entities.

Use this package for common field-level behavior such as parsing query strings,
normalizing nullable timestamps, handling decimal values, validating string
formats, and defining TypeORM transformers.

## Installation

```bash
npm install @nestjs-yalc/field-middleware
```

## Main Exports

- `ParseArray`, `ParseBoolean`, `ParseNumber`, and `ParseInt` transformers.
- `decimalMiddleware` and `nullableTimestampMiddleware` GraphQL field
  middleware.
- TypeORM transformers such as `enumTransformer` and `defaultDateTransformer`.
- `StringFormatMatchValidation`, `DateValidation`, and validation helpers.
- `StringFormatEnum`, `DateCheckTypeEnum`, and field error enums.

## Example

```ts
import { ParseBoolean, ParseInt } from '@nestjs-yalc/field-middleware';

class ListUsersQuery {
  @ParseInt()
  top?: number;

  @ParseBoolean()
  includeDeleted?: boolean;
}
```
