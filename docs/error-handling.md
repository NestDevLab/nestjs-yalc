# Error handling with EventManager and DefaultError

This document explains how to use `@nestjs-yalc/errors` together with `@nestjs-yalc/event-manager` to:

- log errors with structured payloads,
- emit domain events,
- and return the correct HTTP status code and safe response body to the client.

The recommended entry point is `YalcEventService` from `@nestjs-yalc/event-manager`, which wraps the lower-level `event*` helpers and the `DefaultError` hierarchy from `@nestjs-yalc/errors`.

## Building blocks

- **`DefaultError` and subclasses** (`@nestjs-yalc/errors`)
  - Extend Nest `HttpException` and carry:
    - `statusCode` + `statusCodeDescription`
    - a client-safe `message` and `error` name
    - `data` (internal payload) and `masks` (paths to mask)
    - `internalMessage` (for logs only)
    - `eventName` and `config` for event/monitoring metadata.
  - When constructed, they:
    - compute a safe `IBetterResponseInterface` for `getResponse()`,
    - mask `data` as requested,
    - log immediately if `logger` is enabled, using a `LogLevel` derived from the HTTP status,
    - emit an event (`ON_DEFAULT_ERROR_EVENT` by default) if an `EventEmitter2` is provided or globally configured.
  - Specialized classes like `BadRequestError`, `NotFoundError`, `TooManyRequestsError`, etc. have a `static defaultStatusCode` matching the HTTP status they represent; this is what drives both the HTTP code and the default log level.

- **Event helpers** (`@nestjs-yalc/event-manager`)
  - `event*` functions build a unified options object that can:
    - log via an `ImprovedLoggerService`,
    - emit via `EventEmitter2`,
    - optionally create and throw/return a `DefaultError` (or subclass).
  - `getLogLevelByStatus` and `getLogLevelByError` map HTTP status codes (or error classes) to a log level:
    - `>= 500` → `error`
    - `429` → `warn`
    - `400–499` → `log`

- **`YalcEventService`** (`@nestjs-yalc/event-manager`)
  - Injectable Nest service that:
    - receives an `ImprovedLoggerService` and an `EventEmitter2`,
    - exposes levelled logging methods (`log`, `warn`, `debug`, `verbose` and async variants),
    - exposes error helpers that log, emit and throw a typed `DefaultError` (or subclass),
    - offers `neverthrow`-style helpers for functional error handling (`*Result`, `*FromFn`).

## Recommended usage in application code

### 1. Inject `YalcEventService`

Wire `EventModule` in your Nest app and inject `YalcEventService` where you need logging + error handling:

```ts
import { Injectable } from '@nestjs/common';
import { YalcEventService } from '@nestjs-yalc/event-manager';

@Injectable()
export class UserService {
  constructor(private readonly events: YalcEventService) {}
}
```

This gives you a single service that:

- logs through your configured `ImprovedLoggerService`,
- emits events through the configured `EventEmitter2`,
- and can raise HTTP-aware errors.

### 2. Prefer `error*` helpers over raw `HttpException`

Instead of throwing Nest exceptions directly, use the HTTP-specific helpers on `YalcEventService`. Each helper:

- picks the appropriate `DefaultError` subclass (and therefore HTTP code),
- derives the log level from the status code,
- logs and emits the error event with a structured payload.

Example: semantic 404 with safe client response and internal payload:

```ts
async getUserOrFail(id: string) {
  const user = await this.repo.findById(id);
  if (!user) {
    throw this.events.errorNotFound('user.notFound', {
      // internal details for logs and events only
      data: { userId: id },
      // safe payload for the HTTP response
      response: { message: 'User not found' },
      // optional: mask sensitive fields inside `data`
      mask: ['data.userId'],
    });
  }

  return user;
}
```

Under the hood:

- `errorNotFound` sets `errorClass` to `NotFoundError`,
- `NotFoundError` has `defaultStatusCode = 404`,
- `getLogLevelByStatus(404)` resolves to a non-error log level (`log`),
- `DefaultError` logs and emits the event and exposes `getStatus()` / `getResponse()` to Nest.

When this error reaches the HTTP layer:

- the HTTP code is `404`,
- the response body is taken from the `IBetterResponseInterface` produced by `DefaultError` (status code + description + safe message + any extra fields in `response`),
- the internal `data` and `internalMessage` are only visible in logs/events, not exposed to the client.

### 3. Use `errorHttp` for generic status codes

When you only have an HTTP code (possibly not covered by a dedicated helper), use `errorHttp`:

```ts
throw this.events.errorHttp('user.update.failed', 409, {
  data: { userId: id },
  response: { message: 'User is in a conflicting state' },
});
```

This will:

- map `409` to `ConflictError` via `httpStatusCodeToErrors`,
- log at a level derived from the status code,
- throw the resulting `DefaultError` subclass with the right HTTP code.

### 4. Use `*Result` / `*FromFn` helpers for functional flows

When you prefer not to throw, you can use the `neverthrow` helpers:

```ts
import { Result } from 'neverthrow';

async createUser(dto: CreateUserDto): Promise<Result<User, DefaultError>> {
  return this.events.errorFromFn('user.create.failed', async () => {
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) {
      // you can still throw here if you want
      throw this.events.errorConflict('user.email.conflict', {
        data: { email: dto.email },
        response: { message: 'Email already registered' },
      });
    }

    return this.repo.save(dto);
  });
}
```

`errorFromFn` and friends:

- wrap your callback,
- on success return `ok(value)`,
- on failure forward/convert the error into a `DefaultError`, log, emit and return an `Err`.

### 5. Keep internal vs external payloads separate

When building error options:

- use `internalMessage` (or the first constructor argument of `DefaultError` and its subclasses) for the full, developer-focused description of the problem;
- use `data` to attach structured diagnostic data (request ids, input, external error codes, etc.);
- use `masks`/`mask` to hide sensitive paths inside `data` before logging;
- use `response` to describe what is safe to send back to the client.

`DefaultError` will:

- build an `IBetterResponseInterface` based on `response`, the HTTP code and the error name,
- expose it via `getResponse()` for the HTTP layer,
- include a sanitized snapshot of the payload in logs and events.

## How this interacts with Nest exception filters

`DefaultError` and its subclasses are compatible with Nest’s exception pipeline:

- they extend `HttpException`,
- `getStatus()` reflects the HTTP status code (from the specialized class or from the wrapped `HttpException`),
- `getResponse()` returns a structured payload (`IBetterResponseInterface`) that Nest (or your custom filters) can send to the client.

Filters in `@nestjs-yalc/errors/filters` use the same utilities as `YalcEventService` to decide log levels (`getLogLevelByStatus`) and to normalize errors:

- if you throw `DefaultError` (or subclasses) via `YalcEventService`, logging and event emission usually happen inside the error itself;
- filters avoid double-logging these errors and focus on translating non-default errors into HTTP-friendly ones.

In a typical REST setup:

- your application code should use `YalcEventService` for both logging and error creation,
- the resulting errors bubble up through Nest’s filters,
- the client receives a response consistent with the chosen HTTP status and the `response` you provided,
- observability (logs + events) stays consistent because both the `errors` and `event-manager` libraries share the same conventions and helpers.

