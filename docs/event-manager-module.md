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

## Examples

Default wiring with the Nest EventEmitter module:

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

Custom emitter provider and service token:

```ts
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventModule, YalcEventService } from '@nestjs-yalc/event-manager';

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
        loggerProvider: { context: 'CustomEvents' },
      },
      {
        provide: 'EVENT_OPTIONS',
        useValue: {
          logger: { context: 'CustomEvents' },
        },
      },
    ),
  ],
  providers: [MyEventService],
  exports: [MyEventService],
})
export class EventsModule {}
```
