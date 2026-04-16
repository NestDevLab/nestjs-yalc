# API Strategy

This library implements the strategy pattern and factory pattern so you can switch between different API transport types (HTTP, in-process calls, events) through provider configuration or explicit runtime mutation. You code against interfaces, while the concrete strategy can change per environment.

## Getting started

### Strategies included

- **`NestHttpCallStrategy`** — uses Nest `HttpService.axiosRef` for real HTTP calls. It merges CLS-propagated headers (via `YalcGlobalClsService`), applies an optional whitelist, maps `HttpOptions` to Axios config, and supports query parameters via `URLSearchParams`.
- **`NestLocalCallStrategy`** — uses Fastify `inject` to perform in-process HTTP-like calls against your app. Useful for local/dev or “mono” deployments where both caller and callee live in the same Nest runtime. Can optionally skip JSON parsing with `shouldSkipJsonParse`.
- **`NestLocalEventStrategy`** — emits events through `EventEmitter2` (sync or async).
- **Abstracts/interfaces** — `HttpAbstractStrategy` adds `get`/`post` helpers; `IHttpCallStrategy`, `HttpOptions`, `IHttpCallStrategyResponse`, `IHttpCallStrategyOptions` define the HTTP contract; `IApiCallStrategy`/`IEventStrategy` define the core contracts for calls and events.
- **Strategy selector providers** — `StrategySelectorProvider`, `ApiCallStrategySelectorProvider`, and `EventStrategySelectorProvider` expose one stable provider token while selecting one concrete strategy from a registered map.
- **Context services** — `ContextCallServiceFactory` and `ContextEventServiceFactory` build injectable services with `getStrategy`/`setStrategy` for explicit runtime mutation by application code.

You can also implement your own strategies by extending `HttpAbstractStrategy` or providing custom `IApiCallStrategy`/`IEventStrategy` implementations (e.g., gRPC, Kafka, RabbitMQ).

## Providers (Nest wiring)

Use the factory helpers to register strategies as providers in your modules:

```ts
import {
  ApiCallStrategySelectorProvider,
  EventStrategySelectorProvider,
  NestHttpCallStrategyProvider,
  NestLocalCallStrategyProvider,
  NestLocalEventStrategyProvider,
  // Accept the same options, including headersWhitelist/internalRequestHeader/internalRequestToken
} from '@nestjs-yalc/api-strategy';
import { HttpModule } from '@nestjs/axios';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    HttpModule, // required for NestHttpCallStrategy
    EventEmitterModule.forRoot(), // required for NestLocalEventStrategy
  ],
  providers: [
    NestHttpCallStrategyProvider('HTTP_STRATEGY', {
      baseUrl: 'https://api.example.com',
      internalRequestToken: process.env.INTERNAL_REQUEST_TOKEN,
      internalRequestHeader: 'x-internal-request-token',
    }),
    NestLocalCallStrategyProvider('LOCAL_STRATEGY', {
      baseUrl: '/', // path prefix inside the same app
      internalRequestToken: process.env.INTERNAL_REQUEST_TOKEN,
      internalRequestHeader: 'x-internal-request-token',
    }),
    NestLocalEventStrategyProvider('EVENT_STRATEGY'),
    ApiCallStrategySelectorProvider({
      provide: 'API_STRATEGY',
      defaultStrategy: 'local',
      strategies: {
        local: 'LOCAL_STRATEGY',
        http: 'HTTP_STRATEGY',
      },
      selector: {
        useFactory: () => process.env.API_STRATEGY,
      },
    }),
    EventStrategySelectorProvider({
      provide: 'SELECTED_EVENT_STRATEGY',
      defaultStrategy: 'local',
      strategies: {
        local: 'EVENT_STRATEGY',
      },
    }),
  ],
  exports: [
    'HTTP_STRATEGY',
    'LOCAL_STRATEGY',
    'EVENT_STRATEGY',
    'API_STRATEGY',
    'SELECTED_EVENT_STRATEGY',
  ],
})
export class ApiStrategyModule {}
```

Provider options:
- `NestHttpCallStrategyProvider({ baseUrl?, headersWhitelist?, internalRequestHeader?, internalRequestToken?, NestHttpStrategy? })`
  - Injects `HttpService` and `YalcGlobalClsService`.
  - Respects CLS headers (filtered by `headersWhitelist` if provided).
  - Map query params via `options.parameters`.
- `NestLocalCallStrategyProvider({ baseUrl?, headersWhitelist?, internalRequestHeader?, internalRequestToken?, NestLocalStrategy? })`
  - Injects `HttpAdapterHost`, `YalcGlobalClsService`, `AppConfigService`.
  - Uses Fastify `inject`; respects CLS headers and `headersWhitelist`.
  - Adds `internalRequestToken` header when provided (or from `AppConfigService.values.internalRequestToken`).
  - `shouldSkipJsonParse` can bypass `result.json()` when the body isn’t JSON.
- `NestLocalEventStrategyProvider({ NestLocalStrategy? })`
  - Injects `EventEmitter2`, supports `emit` and `emitAsync`.

## Strategy selector providers

Use selector providers when the caller should depend on one stable token while
the concrete transport is chosen from app configuration. The selector does not
construct strategies itself; it selects between strategy provider tokens that
Nest has already resolved.

```ts
import {
  ApiCallStrategySelectorProvider,
  NestHttpCallStrategyProvider,
  NestLocalCallStrategyProvider,
} from '@nestjs-yalc/api-strategy';

export const USER_API_STRATEGY = 'USER_API_STRATEGY';
export const USER_LOCAL_API_STRATEGY = 'USER_LOCAL_API_STRATEGY';
export const USER_HTTP_API_STRATEGY = 'USER_HTTP_API_STRATEGY';

providers: [
  NestLocalCallStrategyProvider(USER_LOCAL_API_STRATEGY, {
    baseUrl: '/users',
  }),
  NestHttpCallStrategyProvider(USER_HTTP_API_STRATEGY, {
    baseUrl: process.env.USERS_HTTP_BASE_URL,
  }),
  ApiCallStrategySelectorProvider({
    provide: USER_API_STRATEGY,
    defaultStrategy: 'local',
    strategies: {
      local: USER_LOCAL_API_STRATEGY,
      http: USER_HTTP_API_STRATEGY,
    },
    selector: {
      useFactory: () => process.env.USERS_API_STRATEGY,
    },
  }),
];
```

The same pattern works for event strategies:

```ts
import {
  EventStrategySelectorProvider,
  NestLocalEventStrategyProvider,
} from '@nestjs-yalc/api-strategy';

export const USER_EVENT_STRATEGY = 'USER_EVENT_STRATEGY';
export const USER_LOCAL_EVENT_STRATEGY = 'USER_LOCAL_EVENT_STRATEGY';
export const USER_RABBITMQ_EVENT_STRATEGY = 'USER_RABBITMQ_EVENT_STRATEGY';

providers: [
  NestLocalEventStrategyProvider(USER_LOCAL_EVENT_STRATEGY),
  // Provide USER_RABBITMQ_EVENT_STRATEGY with a future RabbitMQ/SNS/etc.
  // implementation of IEventStrategy.
  EventStrategySelectorProvider({
    provide: USER_EVENT_STRATEGY,
    defaultStrategy: 'local',
    strategies: {
      local: USER_LOCAL_EVENT_STRATEGY,
      rabbitmq: USER_RABBITMQ_EVENT_STRATEGY,
    },
    selector: {
      useFactory: () => process.env.USERS_EVENT_STRATEGY,
    },
  }),
];
```

Selector options:

- `provide`: final token injected by application services.
- `defaultStrategy`: key used when the selector returns `undefined`, `null`, or
  an empty string.
- `strategies`: map of strategy keys to concrete provider tokens.
- `selector.inject` / `selector.useFactory`: optional Nest-style factory for
  reading configuration from `ConfigService`, environment variables, feature
  flags, or any other provider.
- `unknownStrategyBehavior`: defaults to `throw`; set to `fallback` to use the
  default strategy when configuration names an unknown key.

Prefer selector providers for environment-level transport changes. Use context
services only when you need to mutate the strategy instance after the provider
has been resolved.

## Real-world module client pattern

In application code, keep `api-strategy` behind typed module clients. Put the
client in the reusable domain module/package when one exists, then let each app
wire the concrete strategies and selector. Controllers should expose use cases,
not transport details, and workflow services should depend on client methods
rather than raw URLs.

Recommended layering:

```text
controller -> workflow service -> module API client -> selected API strategy
```

The advanced task app is the reference example:

- `TasksApiClient` is exported by `examples/task/module` and wraps calls to
  `/tasks` and `/projects`.
- `TaskWorkflowsController` exposes real workflows under `/task-workflows`.
- `ApiCallStrategySelectorProvider` keeps the client token stable while
  selecting `local` by default or `http` when `TASKS_API_STRATEGY=http`.
- The e2e suite executes the same workflows through real HTTP and Fastify local
  injection.

The skeleton app shows the same shape in a smaller module:

- `UsersApiClient` is exported by `examples/skeleton/module` and wraps `/users`
  and `/phones`.
- `UsersClientController` exposes the low-level client example under
  `/users-client`.
- The Express runtime uses the HTTP strategy by default, while the e2e suite
  also starts a Fastify app to cover the local strategy.

Use this shape for new apps: keep the typed client close to the domain contract,
then expose application workflows above it instead of thin forwarding endpoints
that only relay transport calls.

## Options reference (HTTP)

`HttpOptions<TData, TParams>`:
- `headers`: request headers (merged with CLS headers and filtered).
- `method`: HTTP verb (defaults set by helper).
- `signal`: `AbortSignal`.
- `data`: request body.
- `parameters`: query parameters (converted to `URLSearchParams`).

`IHttpCallStrategyOptions`:
- `headersWhitelist`: array of header names to propagate from CLS context.
- `shouldSkipJsonParse(body: string)`: for `NestLocalCallStrategy`, decide whether to skip JSON parsing and return raw body.

`IHttpCallStrategyResponse<T>`:
- `data`, `status`, `statusText`, `headers`, `request?`.

`HttpAbstractStrategy`:
- `call(path, options?)`: implemented by concrete strategies.
- `get(path, options?)`, `post(path, options?)`: convenience wrappers that set `method`.

## Context services (runtime mutation)

```ts
import { ContextCallServiceFactory, ContextEventServiceFactory } from '@nestjs-yalc/api-strategy';

const CallService = ContextCallServiceFactory(defaultHttpStrategy);
const EventService = ContextEventServiceFactory(defaultEventStrategy);
```

Inject these services to `getStrategy()` or `setStrategy(newStrategy)` when a
consumer must mutate the strategy instance after construction. For normal
app-configuration switches, prefer the selector providers above.

## Usage example

```ts
import { Inject, Injectable } from '@nestjs/common';
import { IHttpCallStrategy, IEventStrategy } from '@nestjs-yalc/api-strategy';

@Injectable()
export class UserService {
  constructor(
    @Inject('API_STRATEGY') private readonly http: IHttpCallStrategy,
    @Inject('SELECTED_EVENT_STRATEGY') private readonly events: IEventStrategy,
  ) {}

  async createUser(userId: string) {
    await this.http.post('/users', { data: { id: userId } });
    await this.events.emitAsync('user.created', { userId });
  }
}
```

## Use cases

- Start with local-call/local-event for fast dev/test in a monolith, then switch to HTTP or other transports without refactoring callers.
- Route per-environment using selector providers, while keeping caller tokens stable.
- Keep event transport open for future brokers by selecting between `IEventStrategy`
  implementations such as local `EventEmitter2`, RabbitMQ, SNS, or other transports.
- Use context services only for explicit runtime mutation by application code.
- Prototype service-to-service communication before introducing full API gateways/brokers.
