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
  - a token (`string`) to resolve elsewhere
  - a config object `{ context, loggerLevels?, loggerType?, options? }` passed to `AppLoggerFactory`
  - if omitted, a logger is created via `AppLoggerFactory('default')`.
- `eventEmitter`: optional provider for `EventEmitter2`; if omitted, the module expects an `EventEmitter2` provider to be available (e.g., from `@nestjs/event-emitter`).
- `imports`: extra modules needed by your providers (e.g., `EventEmitterModule.forRoot()`).
- `overrideLoggerLevels`: optional `LogLevel[]` (currently not applied by the module).

`optionProvider` is an optional provider for `IProviderOptions` (`{ logger: ImprovedLoggerService | ILoggerProviderOptionsObject; emitter: EventEmitter2 }`) so you can inject logger/emitter instances created elsewhere.

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

Custom emitter provider and service token:

```ts
import { EventEmitter2 } from "@nestjs/event-emitter";
import { EventModule, YalcEventService } from "@nestjs-yalc/event-manager";

class MyEventService extends YalcEventService {}

@Module({
  imports: [
    EventModule.forRootAsync(
      {
        eventEmitter: {
          provide: EventEmitter2,
          useFactory: () =>
            new EventEmitter2({ wildcard: true, maxListeners: 200 }),
        },
        eventService: (logger, emitter, options) =>
          new MyEventService(logger, emitter, options),
        eventServiceToken: MyEventService,
        loggerProvider: { context: "CustomEvents" },
      },
      {
        provide: "EVENT_OPTIONS",
        useValue: {
          logger: { context: "CustomEvents" },
        },
      }
    ),
  ],
  providers: [MyEventService],
  exports: [MyEventService],
})
export class EventsModule {}
```
