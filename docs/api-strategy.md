# API Strategy

This library implements the strategy pattern and factory pattern so you can switch, at runtime, between different API transport types (HTTP, in-process calls, events). You code against interfaces, while the concrete strategy can change per environment.

## Getting started

### Strategies included

- **`NestHttpCallStrategy`** — uses Nest `HttpService.axiosRef` for real HTTP calls. It merges CLS-propagated headers (via `YalcGlobalClsService`), applies an optional whitelist, maps `HttpOptions` to Axios config, and supports query parameters via `URLSearchParams`.
- **`NestLocalCallStrategy`** — uses Fastify `inject` to perform in-process HTTP-like calls against your app. Useful for local/dev or “mono” deployments where both caller and callee live in the same Nest runtime. Can optionally skip JSON parsing with `shouldSkipJsonParse`.
- **`NestLocalEventStrategy`** — emits events through `EventEmitter2` (sync or async).
- **Abstracts/interfaces** — `HttpAbstractStrategy` adds `get`/`post` helpers; `IHttpCallStrategy`, `HttpOptions`, `IHttpCallStrategyResponse`, `IHttpCallStrategyOptions` define the HTTP contract; `IApiCallStrategy`/`IEventStrategy` define the core contracts for calls and events.
- **Context services** — `ContextCallServiceFactory` and `ContextEventServiceFactory` build injectable services with `getStrategy`/`setStrategy` so you can swap implementations at runtime (per environment or feature flag).

You can also implement your own strategies by extending `HttpAbstractStrategy` or providing custom `IApiCallStrategy`/`IEventStrategy` implementations (e.g., gRPC, Kafka, RabbitMQ).

## Providers (Nest wiring)

Use the factory helpers to register strategies as providers in your modules:

```ts
import {
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
  ],
  exports: ['HTTP_STRATEGY', 'LOCAL_STRATEGY', 'EVENT_STRATEGY'],
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

## Context services (runtime switching)

```ts
import { ContextCallServiceFactory, ContextEventServiceFactory } from '@nestjs-yalc/api-strategy';

const CallService = ContextCallServiceFactory(defaultHttpStrategy);
const EventService = ContextEventServiceFactory(defaultEventStrategy);
```

Inject these services to `getStrategy()` or `setStrategy(newStrategy)` at runtime (e.g., env-based toggles, gradual rollout).

## Usage example

```ts
import { Inject, Injectable } from '@nestjs/common';
import { IHttpCallStrategy, IEventStrategy } from '@nestjs-yalc/api-strategy';

@Injectable()
export class UserService {
  constructor(
    @Inject('HTTP_STRATEGY') private readonly http: IHttpCallStrategy,
    @Inject('EVENT_STRATEGY') private readonly events: IEventStrategy,
  ) {}

  async createUser(userId: string) {
    await this.http.post('/users', { data: { id: userId } });
    await this.events.emitAsync('user.created', { userId });
  }
}
```

## Use cases

- Start with local-call/local-event for fast dev/test in a monolith, then switch to HTTP or other transports without refactoring callers.
- Route per-environment or per-tenant using strategy switching (via the context services).
- Prototype service-to-service communication before introducing full API gateways/brokers.
