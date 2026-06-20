# @nestjs-yalc/errors

Typed application errors and Result helpers for YALC and NestJS applications.

Use this package with `@nestjs-yalc/event-manager` when you need errors that
can carry safe client responses, internal diagnostics, structured data, HTTP
status codes, and logging metadata.

## Installation

```bash
npm install @nestjs-yalc/errors
```

## Main Exports

- `DefaultError` and HTTP-aware subclasses.
- Error enums and result helpers.
- `MissingArgumentsError` re-exported from CrudGen for compatibility.

## Example

```ts
import { BadRequestError } from '@nestjs-yalc/errors';

throw new BadRequestError('user.invalidEmail', {
  response: { message: 'Invalid email address.' },
  data: { field: 'email' },
});
```

## Documentation

- Error handling guide:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/error-handling.md
- DefaultError library:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/errors.md
