# YalcEventModule

`EventModule` wires up `YalcEventService` with an `ImprovedLoggerService` and an `EventEmitter2` using Nest providers, giving you a ready-to-use event/log/error pipeline in any NestJS app.

Read alongside [YalcEventService](./event-manager-service.md) for runtime behavior.

## API

```ts
EventModule.forRootAsync(options?: IEventModuleOptions, optionProvider?: Provider<IProviderOptions>);
```

- `eventServiceToken`: provider token to export (default: `YalcEventService`).
- `eventService`: factory `(logger, emitter, options?) => YalcEventService` to supply a custom subclass/instance.
- `loggerProvider`: one of:
  - an `ImprovedLoggerService` instance
  - a Nest provider object
  - a legacy token (`string`) under which a new local default logger is registered; it does **not** reuse an imported logger with that token
  - a config object `{ context, loggerLevels?, loggerType?, options? }` passed to `AppLoggerFactory`
  - if omitted, a logger is created via `AppLoggerFactory('default')`.
- `eventEmitter`: explicit Nest provider for `EventEmitter2`. Otherwise use `optionProvider.emitter`, then an imported `EventEmitter2` (e.g., `EventEmitterModule.forRoot()`). Startup fails with a configuration error if none is available.
- `imports`: extra modules needed by your providers (e.g., `EventEmitterModule.forRoot()`).
- `overrideLoggerLevels`: **deprecated no-op**, retained for compatibility. Set `loggerProvider.loggerLevels` for factory-created loggers, or configure your external logger directly. The module does not mutate a shared logger.

`optionProvider` must register the exported `OPTION_PROVIDER` token. Its value is
`{ logger?: ImprovedLoggerService | ILoggerProviderOptionsObject; emitter?: EventEmitter2 }`.
A factory may inject dependencies exported by `options.imports`.

Precedence is explicit:

| Dependency | Highest priority                      | Next                      | Fallback                                           |
| ---------- | ------------------------------------- | ------------------------- | -------------------------------------------------- |
| Logger     | Explicit Nest `loggerProvider` object | `OPTION_PROVIDER.logger`  | Logger instance/config/string/default in `options` |
| Emitter    | Explicit Nest `eventEmitter` provider | `OPTION_PROVIDER.emitter` | Imported `EventEmitter2`                           |

Use a Nest `{ provide: EVENT_LOGGER, useExisting: EXTERNAL_LOGGER }` provider to
reuse an external logger by identity. The external token must be exported from a
module in `options.imports`. The same rule applies to emitter aliases. Missing
`useExisting` dependencies produce Nest's normal dependency-resolution error.

Exports: the resolved logger provider token and the `eventServiceToken`.

## Broker-backed domain events

`EventModule` remains intentionally focused on the local event/log/error
pipeline around `YalcEventService` and `EventEmitter2`. When an application
needs a broker such as RabbitMQ, keep the broker behind an `IEventStrategy`
client rather than coupling `YalcEventService` directly to the broker.

Broker-backed strategies should stay focused on broker publishing. If a domain
event must also reach same-runtime handlers, compose the broker strategy with
the local `EventEmitter2` strategy through `CompositeEventStrategy`.

The task-system example uses:

```text
TasksDomainEventsService -> TasksEventsClient -> local or composed local+RabbitMQ event strategy
```

This lets the service keep using `YalcEventService` for structured logging and
HTTP-aware errors while selected domain events continue to reach in-process
handlers and can also be published through a real broker when
`TASK_EVENTS_STRATEGY=rabbitmq` is configured. The RabbitMQ branch can be
disabled independently with `TASK_RABBITMQ_PUBLISH_ENABLED=false` while local
handlers stay active.

## Observability plugin

`EventModule` does not depend on OpenTelemetry. Applications that need external
monitoring should install `@nestjs-yalc/observability` and register
`ObservabilityModule` next to their EventManager wiring. The observability
plugin listens to the same `EventEmitter2` events emitted by `YalcEventService`
and exports them as OpenTelemetry telemetry without changing EventManager
runtime behavior.

## Examples

Default wiring with the Nest EventEmitter module:

```ts
import { EventEmitterModule } from "@nestjs/event-emitter";
import { EventModule } from "@nestjs-yalc/event-manager";

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    EventModule.forRootAsync({
      loggerProvider: { context: "AppEvents" },
    }),
  ],
})
export class AppModule {}
```

Reuse external instances and export a custom service token:

```ts
import { Module } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ImprovedNestLogger } from "@nestjs-yalc/logger";
import {
  EventModule,
  EVENT_LOGGER,
  YalcEventService,
} from "@nestjs-yalc/event-manager";

@Module({
  providers: [
    {
      provide: "APP_LOGGER",
      useValue: new ImprovedNestLogger("AppEvents", {}),
    },
    { provide: "APP_EMITTER", useValue: new EventEmitter2() },
  ],
  exports: ["APP_LOGGER", "APP_EMITTER"],
})
class SharedEventsModule {}

class MyEventService extends YalcEventService {}

@Module({
  imports: [
    EventModule.forRootAsync({
      imports: [SharedEventsModule],
      loggerProvider: { provide: EVENT_LOGGER, useExisting: "APP_LOGGER" },
      eventEmitter: { provide: "EVENT_BUS", useExisting: "APP_EMITTER" },
      eventService: (logger, emitter, options) =>
        new MyEventService(logger, emitter, options),
      eventServiceToken: "MY_EVENTS",
    }),
  ],
})
export class AppModule {}
```

Providers in `AppModule` can inject `EVENT_LOGGER` and `'MY_EVENTS'`. The
logger and the service's emitter are the exact shared instances. Do not
register `MyEventService` a second time in `providers`; that would bypass the
configured factory.

Options-provider wiring without a separate `EventEmitterModule`:

```ts
EventModule.forRootAsync(
  {},
  {
    provide: OPTION_PROVIDER,
    useFactory: () => ({
      logger: { context: "AppEvents", loggerLevels: ["error", "warn"] },
      emitter: new EventEmitter2(),
    }),
  },
);
```

Import `OPTION_PROVIDER` from `@nestjs-yalc/event-manager`. A provider registered
under another token is not used as options.
