# Event helpers

This TypeScript library provides a flexible, configurable pipeline for events: one call can log, emit via `EventEmitter2`, mask sensitive fields, and optionally raise typed errors. The core `event` helper centralizes behavior through a single options object, supports custom name formatters and aliases, and can run fire-and-forget or awaited flows. Use it directly or through [`YalcEventService`](./event-manager-service.md) and wire it with [`EventModule`](./event-manager-module.md); it pairs with [`Logger`](./logger.md) and [`Errors`](./errors.md).

## Core APIs

- `event(eventName, options?)`: core helper that builds the payload, logs (unless `logger: false`), emits (unless `event: false`), and optionally throws/returns an error instance.
- Level helpers: `eventLog`, `eventWarn`, `eventDebug`, `eventVerbose` and their `*Async` variants set the `logger.level` to the corresponding `LogLevelEnum`.
- Error helpers: `eventError`/`eventErrorAsync` force `logger.level` to `error` and default `errorClass` to `DefaultError`.
- `applyAwaitOption(options)`: convenience that sets `event.await` to `true` unless explicitly provided.

## Options reference

Shared options (`IEventOptions`):

- `data`: extra information to pass along; always enriched with `eventName` before logging/emitting. Strings are wrapped into `{ message: string }`.
- `config`: additional metadata forwarded to logger and emitted payload.
- `message`: overrides the default log message (`formattedEventName`).
- `mask`: array of paths to mask via `maskDataInObject`.
- `stack`: stack trace used by logger/error payload when provided.
- `event`: `false` to skip emitting; otherwise `{ emitter?, formatter?, await? }`. Defaults: emitter = `getYalcGlobalEventEmitter()`, formatter = provided formatter (if any), await = `true` when set via `applyAwaitOption`.
- `eventAliases`: extra event names to emit; accepts strings or `{ eventName, await }`.
- `logger`: `false` to skip logging; string to force a level; or `{ instance?, level? }`. Defaults to `AppLoggerFactory('Event')` with level derived by the helper you call.

Error-specific options (`IErrorEventOptions`):

- `errorClass`: `true` (default for `eventError*`) uses `DefaultError`; a class instantiates that error; an instance forwards it; `false` disables throwing and only logs/emits.
- `response`, `context`, `data`, `config`, `cause`, `stack`, `statusCode` (from `@nestjs-yalc/errors`) are merged into the emitted/logged error payload. When `cause` is provided, its stack is picked up if no stack is set.

## Return values

- When `errorClass` is truthy and the resulting instance is a `DefaultError`, that error is returned/thrown.
- If `errorClass` is `false`, the return is the emitter result (`boolean` or array) or a `Promise` thereof when `await: true`.
- All `*Async` helpers return `Promise<...>`; `applyAwaitOption` plus `event*` will also register pending promises with the global promise tracker.

## Event name formatting and builders

- `formatName`/`emitEvent` accept a `formatter: (...args) => string`. Built-ins:
  - `simpleFormatter('Action')` → `onAction`
  - `simpleDotFormatter('a','b','c')` → `a.b.c`
  - `versionedDomainActionFormatter(version, context, action, when = 'onProcess')` → `${version}.${context}.${action}.${when}`
- `EventNameBuilder.events(domain, actions)` constructs a tree of event names (with `base`/`all` wildcards) for strongly-typed, versioned naming.

## Global emitter defaults

If no emitter is provided, `event` uses the global emitter from `getYalcGlobalEventEmitter()`, backed by `EventEmitter2` configured with `maxListeners: 1000` and `wildcard: true`. Prefer passing your own emitter in production; `setYalcGlobalEventEmitter` exists only for advanced scenarios.

## Examples

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
import { event, eventError, simpleDotFormatter } from '@nestjs-yalc/event-manager';

const emitter = new EventEmitter2({ wildcard: true });
emitter.on('user.created', (payload) => {
  // react to event
});

await event(['user', 'created'], {
  formatter: simpleDotFormatter,
  data: { userId: 123 },
  event: { emitter },
});

throw eventError('user.create.failed', {
  data: { userId: 123 },
  message: 'User creation failed',
  mask: ['data.userId'],
  logger: { level: 'error' },
  event: { emitter, await: true },
});
```
