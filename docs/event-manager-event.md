# Event helpers

This TypeScript library provides a flexible, configurable pipeline for events: one call can log, emit via `EventEmitter2`, mask sensitive fields, and optionally create typed errors. The core `event` helper centralizes behavior through a single options object, supports custom name formatters and aliases, and can run fire-and-forget or awaited flows. Use it directly or through [`YalcEventService`](./event-manager-service.md) and wire it with [`EventModule`](./event-manager-module.md); it pairs with [`Logger`](./logger.md) and [`Errors`](./errors.md).

## Core APIs

- `event(eventName, options?)`: core helper that builds the payload, logs (unless `logger: false`), emits (unless `event: false`), and optionally returns an error instance.
- Level helpers: `eventLog`, `eventWarn`, `eventDebug`, `eventVerbose` and their `*Async` variants set the `logger.level` to the corresponding `LogLevelEnum`.
- Error helpers: `eventError`/`eventErrorAsync` default `logger.level` to `error` (an explicit level wins) and default `errorClass` to `DefaultError`.
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

- `errorClass`: `true` (default for `eventError*`) uses `DefaultError`; a class instantiates that error; an instance forwards it; `false` disables error creation and only logs/emits.
- `response`, `context`, `data`, `config`, `cause`, `stack`, `statusCode` (from `@nestjs-yalc/errors`) are merged into the emitted/logged error payload. When `cause` is provided, its stack is picked up if no stack is set.

## Return values

- `event`, `eventError`, and synchronous service error/Result methods return the error instance immediately when `errorClass` is truthy. They do not throw it: use `throw eventError(...)` explicitly. This remains true with `event.await: true`.
- Without an error instance, `event` returns a Promise of the primary emission result (`boolean`, listener results array, or `undefined` when emission is disabled), after awaited aliases complete.
- All `*Async` helpers default `event.await` to `true`, including when no event options are supplied. `eventErrorAsync` resolves with the error instance only after the primary emission and awaited aliases succeed.
- String aliases inherit `event.await`. Object aliases use their own `await` value. `event.await: false` or an alias's `await: false` opts out of waiting for that listener's asynchronous work; `event: false` disables all emissions.
- Non-awaited listeners own their asynchronous failures: EventEmitter2 `emit` ignores returned promises, so listeners must handle their own rejections. The helper cannot propagate these detached failures.
- An awaited listener's throw/rejected Promise rejects the async helper with that listener error, rather than resolving with the constructed application error. Rejection is fail-fast; other listeners are not cancelled. Primary and alias rejections are observed together, including while another emission is blocked. Nest `@OnEvent` handlers must disable `suppressErrors` if their errors should propagate through EventEmitter2.
- Emission promises are registered with the global promise tracker. Synchronous error and `*Result` methods do not provide a per-call completion/failure Promise; use `eventErrorAsync`/`service.errorAsync` when completion matters. `*FromFn` wraps the callback outcome and uses synchronous Result helpers; it does not wait for event listeners.

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
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  event,
  eventError,
  simpleDotFormatter,
} from "@nestjs-yalc/event-manager";

const emitter = new EventEmitter2({ wildcard: true });
emitter.on("user.created", (payload) => {
  // react to event
});

await event(["user", "created"], {
  data: { userId: 123 },
  event: { emitter, formatter: simpleDotFormatter, await: true },
});

throw eventError("user.create.failed", {
  data: { userId: 123 },
  message: "User creation failed",
  mask: ["data.userId"],
  logger: { level: "error" },
  event: { emitter },
});
```
