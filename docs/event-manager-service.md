# YalcEventService

`YalcEventService` is the NestJS-facing façade over the event helpers: it injects logger + emitter, applies defaults, and exposes a rich set of logging and error helpers (with neverthrow `Result` variants) so you can keep event, log, and error handling consistent across your app.

Please also see [Event helpers](./event-manager-event.md), [Event module](./event-manager-module.md), [Logger](./logger.md), and [Errors](./errors.md).

## Constructor

```ts
constructor(
  loggerService: ImprovedLoggerService,
  eventEmitter: EventEmitter2,
  options?: { formatter?: EventNameFormatter },
)
```

- `formatter` becomes the default formatter when one is not provided in call-level options.
- `loggerService` is always reused unless you explicitly disable logging with `logger: false`.
- `eventEmitter` is injected into every call unless you override via `options.event`.

Properties:

- `logger`: the injected `ImprovedLoggerService`.
- `emitter`: the injected `EventEmitter2`.
- `emit` / `emitAsync`: aliases of `log` / `logAsync`.

## Logging methods

All methods accept `eventName: Parameters<TFormatter> | string` and optional `IEventOptions<TFormatter>`; options are merged with the constructor defaults.

- `log` / `logAsync`
- `warn` / `warnAsync`
- `debug` / `debugAsync`
- `verbose` / `verboseAsync`

These simply delegate to the corresponding `event*` helpers, applying the injected emitter/logger.

## Error methods

General helpers:

- `error` / `errorAsync`: raise/log using `DefaultError` by default. Decorated with `InjectTrace` to populate `stack` if none is provided.
- `errorResult`: wraps `error` in a `neverthrow.Err`.
- `errorFromFn`: executes a callback, returning `ok(result)` or `Err(DefaultError)` on failure.
- `errorForward`: forward/normalize an existing error (instance or class) into a `DefaultError`, preserving/merging payloads. Logger level is inferred from the status code unless explicitly set.
- `errorForwardResult` / `errorForwardFromFn`: neverthrow variants of forwarding helpers.

HTTP-specific helpers:

- `errorHttp(code, options?)`: map an HTTP status to a corresponding error class (fallback `InternalServerError`) and apply the appropriate logger level.
- Dedicated methods for common statuses (each with `*Result` and `*FromFn` variants): `errorBadRequest`, `errorUnauthorized`, `errorPaymentRequired`, `errorForbidden`, `errorNotFound`, `errorMethodNotAllowed`, `errorNotAcceptable`, `errorConflict`, `errorGone`, `errorUnsupportedMediaType`, `errorUnprocessableEntity`, `errorTooManyRequests`, `errorInternalServerError`, `errorNotImplemented`, `errorBadGateway`, `errorServiceUnavailable`, `errorGatewayTimeout`.

Each helper deep-merges the provided options with the constructor defaults, sets `errorClass` to the matching error type, and derives the logger level from the status (500+ → error, 429 → warn, 4xx → log) unless you override it.

## Option handling and defaults

- `buildOptions` merges call-level options with the injected emitter/formatter and logger instance. If an error instance or `cause` is provided, it ensures a `stack` is present.
- `buildErrorOptions` guarantees an `errorClass` (default `true` → `DefaultError`).
- `applyLoggerLevel`/`applyLoggerLevelByStatus`/`applyLoggerLevelByError` set `logger.level` automatically when not explicitly provided.
- `applyCause` attaches the original error as `cause`, enriching the payload when forwarded.
- Pending promises triggered by event emission are registered with the global promise tracker.

## Examples

Module wiring with Nest:

```ts
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventModule } from '@nestjs-yalc/event-manager';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    EventModule.forRootAsync({
      loggerProvider: { context: 'AppEvents' },
    }),
  ],
})
export class AppModule {}
```

Usage in a provider:

```ts
import { YalcEventService } from '@nestjs-yalc/event-manager';

@Injectable()
export class UserService {
  constructor(private readonly events: YalcEventService) {}

  async create(user: CreateUserDto) {
    try {
      // Emit + log a success event
      await this.events.log(['user', 'created'], {
        data: { userId: user.id },
        event: { await: true },
      });
      return user;
    } catch (error) {
      // Forward and log the error with merged context
      throw this.events.errorForward('user.create.failed', error, {
        data: { userId: user.id },
      });
    }
  }
}
```
