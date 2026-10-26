# API Strategy

This library implements the strategy pattern and factory pattern so you can switch between different API transport types (HTTP, in-process calls, events) through provider configuration or explicit runtime mutation. You code against interfaces, while the concrete strategy can change per environment.

## Getting started

### Strategies included

- **`NestHttpCallStrategy`** — uses Nest `HttpService.axiosRef` for real HTTP calls. It merges CLS-propagated headers (via `YalcGlobalClsService`), applies an optional whitelist, maps `HttpOptions` to Axios config, and supports query parameters via `URLSearchParams`.
- **`NestLocalCallStrategy`** — uses Fastify `inject` to perform in-process HTTP-like calls against your app. Useful for local/dev or “mono” deployments where both caller and callee live in the same Nest runtime. Can optionally skip JSON parsing with `shouldSkipJsonParse`.
- **`NestLocalEventStrategy`** — emits events through `EventEmitter2` (sync or async).
- **`RabbitMqEventStrategy`** — publishes events to a RabbitMQ exchange. It is a broker transport only; compose it with `NestLocalEventStrategy` when same-runtime handlers must run too.
- **Strategy wrappers** — `CompositeEventStrategy`, `ConditionalEventStrategy`, `ConditionalCallStrategy`, `FallbackCallStrategy`, and `ShadowCallStrategy` let you fan out, disable, filter, fallback, or shadow strategies without changing the concrete transports.
- **Abstracts/interfaces** — `HttpAbstractStrategy` adds `get`/`post` helpers; `IHttpCallStrategy`, `HttpOptions`, `IHttpCallStrategyResponse`, `IHttpCallStrategyOptions` define the HTTP contract; `IApiCallStrategy`/`IEventStrategy` define the core contracts for calls and events.
- **Strategy selector providers** — `StrategySelectorProvider`, `ApiCallStrategySelectorProvider`, and `EventStrategySelectorProvider` expose one stable provider token while selecting one concrete strategy from a registered map.
- **Context services** — `ContextCallServiceFactory` and `ContextEventServiceFactory` build injectable services with `getStrategy`/`setStrategy` for explicit runtime mutation by application code.

You can also implement your own strategies by extending `HttpAbstractStrategy` or providing custom `IApiCallStrategy`/`IEventStrategy` implementations (e.g., gRPC, Kafka, SNS).

## Providers (Nest wiring)

Use the factory helpers to register strategies as providers in your modules:

```ts
import {
  ApiCallStrategySelectorProvider,
  CompositeEventStrategy,
  ConditionalEventStrategy,
  EventStrategySelectorProvider,
  NestHttpCallStrategyProvider,
  NestLocalCallStrategyProvider,
  NestLocalEventStrategyProvider,
  RabbitMqEventStrategy,
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
    {
      provide: 'RABBITMQ_EVENT_STRATEGY',
      useFactory: (localStrategy) =>
        new CompositeEventStrategy([
          localStrategy,
          new ConditionalEventStrategy(
            new RabbitMqEventStrategy({
              url: process.env.RABBITMQ_URL ?? 'amqp://127.0.0.1:5672',
              exchange: 'app.events',
            }),
            {
              enabled: () => process.env.RABBITMQ_PUBLISH_ENABLED !== 'false',
              disabledResult: false,
            },
          ),
        ]),
      inject: ['EVENT_STRATEGY'],
    }),
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
        rabbitmq: 'RABBITMQ_EVENT_STRATEGY',
      },
      selector: {
        useFactory: () => process.env.EVENT_STRATEGY,
      },
    }),
  ],
  exports: [
    'HTTP_STRATEGY',
    'LOCAL_STRATEGY',
    'EVENT_STRATEGY',
    'RABBITMQ_EVENT_STRATEGY',
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
- `RabbitMqEventStrategyProvider({ RabbitMqStrategy?, options })`
  - Publishes `emit`/`emitAsync` calls to RabbitMQ.
  - It does not emit through `EventEmitter2` by itself. Use
    `CompositeEventStrategy` to combine local runtime handlers and broker
    publishing.
  - `options.url` and `options.exchange` are required.
  - Optional `exchangeType`, `durable`, `persistent`, `contentType`,
    `publishOptions`, and `serialize` customize broker behavior.
- `CompositeEventStrategy(strategies, { errorMode? })`
  - Emits the same event through every nested strategy.
  - Use it for local + RabbitMQ, local + Kafka, or multi-broker fan-out.
  - `errorMode: 'throw'` is the default; `ignore` skips failed branches.
- `ConditionalEventStrategy(strategy, { enabled?, shouldEmit?, disabledResult? })`
  - Wraps any event strategy with a feature flag or per-event predicate.
  - Use it to disable a broker publish while leaving the rest of a composite
    strategy active.
- `ConditionalCallStrategy(strategy, { enabled?, disabledResponse?, disabledError? })`
  - Wraps any call strategy with a feature flag.
- `FallbackCallStrategy(strategies, { shouldFallback? })`
  - Tries call strategies in order until one succeeds.
  - Use it for explicit migration/failover cases, not as a default replacement
    for a clear selected transport.
- `ShadowCallStrategy(primary, shadows, { awaitShadows?, shadowErrorMode? })`
  - Returns the primary call response and also invokes one or more shadow
    transports.
  - Use it to compare an HTTP implementation with a future gRPC implementation
    while keeping HTTP as the user-facing result.

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
  CompositeEventStrategy,
  ConditionalEventStrategy,
  EventStrategySelectorProvider,
  NestLocalEventStrategyProvider,
  RabbitMqEventStrategy,
} from '@nestjs-yalc/api-strategy';

export const USER_EVENT_STRATEGY = 'USER_EVENT_STRATEGY';
export const USER_LOCAL_EVENT_STRATEGY = 'USER_LOCAL_EVENT_STRATEGY';
export const USER_RABBITMQ_EVENT_STRATEGY = 'USER_RABBITMQ_EVENT_STRATEGY';

providers: [
  NestLocalEventStrategyProvider(USER_LOCAL_EVENT_STRATEGY),
  {
    provide: USER_RABBITMQ_EVENT_STRATEGY,
    useFactory: (localStrategy) =>
      new CompositeEventStrategy([
        localStrategy,
        new ConditionalEventStrategy(
          new RabbitMqEventStrategy({
            url: process.env.RABBITMQ_URL,
            exchange: 'users.events',
          }),
          {
            enabled: () => process.env.USER_RABBITMQ_PUBLISH_ENABLED !== 'false',
            disabledResult: false,
          },
        ),
      ]),
    inject: [USER_LOCAL_EVENT_STRATEGY],
  }),
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

## Strategy composition

Composition is intentionally separate from selection:

- selectors choose one named strategy for the current environment
- wrappers modify or combine strategies
- concrete strategies stay focused on one transport

For events, this means a broker strategy should not also own local runtime
dispatch. Compose both branches instead:

```ts
new CompositeEventStrategy([
  localEventStrategy,
  new ConditionalEventStrategy(rabbitMqEventStrategy, {
    enabled: () => process.env.RABBITMQ_PUBLISH_ENABLED !== 'false',
    disabledResult: false,
  }),
]);
```

For call strategies, prefer one selected transport in normal request paths.
Reach for wrappers only when the use case is explicit:

- `ConditionalCallStrategy` for feature-flagged outbound calls
- `FallbackCallStrategy` for migration/failover flows where retrying a second
  transport is acceptable
- `ShadowCallStrategy` for dual-running a future transport without changing
  the response returned to callers

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
- Keep event transport open for future brokers by selecting or composing
  `IEventStrategy` implementations such as local `EventEmitter2`, RabbitMQ,
  Kafka, SNS, or other transports.
- Use context services only for explicit runtime mutation by application code.
- Prototype service-to-service communication before introducing full API gateways/brokers.

## Failure, cancellation, and delivery contracts

Local Fastify injection and remote HTTP retain their legacy defaults: local
calls resolve responses including 4xx/5xx, while HTTP uses the configured Axios
instance's status policy (Axios defaults reject responses outside 2xx). Switching
transport alone therefore does not guarantee identical fallback behavior.

To opt into the same acceptance policy, set `validateStatus` on both provider
options, strategy constructor options, or individual `HttpOptions` requests:

```ts
const validateStatus = (status: number) => status >= 200 && status < 300;
NestLocalCallStrategyProvider('LOCAL', { validateStatus });
NestHttpCallStrategyProvider('HTTP', { validateStatus });
```

An explicit policy replaces Axios status validation for that request. Both
strategies then reject unacceptable responses with `HttpStatusPolicyError`,
whose `response` contains `status`, `headers`, and parsed `data`. A request's
policy overrides the strategy policy; `() => true` accepts all statuses.
Transport failures and cancellation retain their native error types. Review
Axios response interceptors separately: they can reject or transform responses
before this strategy evaluates its policy.

Both transports reject an already-aborted `signal` before dispatch. Local
injection also stops waiting when an in-flight signal aborts and removes its
abort listener when the call settles. It does not abort the server handler.
Remote cancellation stops the HTTP caller, but cannot guarantee that the server
stopped. In either case a write may have succeeded even when the caller sees
cancellation, a timeout, a disconnected connection, or a lost response. A custom
local abort reason is preserved as the rejection reason.

`FallbackCallStrategy` is an explicitly ordered chain, not a safe automatic
retry engine. Its default advances on any rejection; use `shouldFallback` to
restrict eligible errors. It only sees resolved HTTP failures as failures when
the configured status policy rejects them. The application owns retry budgets,
backoff, idempotency keys, deduplication and reconciliation of uncertain writes.
Do not fall back or shadow a write unless duplicate execution is acceptable or
the server enforces idempotency. `ShadowCallStrategy` starts shadows only after
a successful primary response. Synchronous shadow throws and rejected promises
follow the same error policy, and do not prevent other shadow branches starting.
With `awaitShadows: false`, failures are contained even if `shadowErrorMode` is
`throw`; use awaited shadows to propagate failures. A propagated shadow failure
cannot undo a successful primary write.

### RabbitMQ lifecycle and acknowledgement boundary

`RabbitMqEventStrategy` shares one cold initialization across concurrent calls.
It caches a channel only after exchange assertion succeeds. Failed setup closes
partial resources; all callers of that initialization observe its failure.
Channel or connection `error`/`close` events invalidate the resource pair, and
cleanup completes before a later explicit emit may initialize again. Late events
from an old pair do not invalidate a replacement. Recovery is bounded to one
setup attempt per explicit call (shared by concurrent cold callers): no timer
reconnect loop, automatic message replay, or publish retry is performed.

`emitAsync` resolves to the boolean returned by amqplib's ordinary
`channel.publish`: `false` indicates buffer backpressure, and `true` indicates
buffer acceptance. Neither is a broker confirmation, consumer acknowledgement,
or proof of durable delivery. Applications needing broker confirmations or
transactional outbox semantics must supply an appropriate strategy/protocol.
`emit` immediately returns `true` after scheduling background work; it reports
neither publication success nor backpressure. Prefer `emitAsync` where the
caller needs failures. For fire-and-forget observability configure:

```ts
new RabbitMqEventStrategy({
  url: brokerUrl,
  exchange: 'app.events',
  onBackgroundError: (error) => diagnostics.record(error),
});
```

The optional diagnostics callback receives background publish/setup failures;
its own synchronous throws or rejected promises are contained. The default
remains non-blocking and silent. This callback is not a retry hook and does not
report every idle connection lifecycle event.

Concurrent and repeated shutdown calls share one teardown result. Shutdown
permanently refuses new emissions and waits for in-flight setup to
finish so late resources cannot resurrect the strategy. It attempts channel and
connection cleanup even if either close fails, clears cached state, and reports
unexpected cleanup failures. Each close waits at most one second before the
existing socket/heartbeat cleanup fallback. Connection establishment and
exchange assertion still depend on amqplib/network settlement: configure broker
connection timeouts at the transport boundary; shutdown does not impose an
additional setup timeout. Create a new strategy instance after shutdown.

`CompositeEventStrategy.emitAsync` starts every branch and waits for all to
settle. Both synchronous method throws and rejected promises follow `errorMode`:
`ignore` returns successful branch results; `throw` rejects with the first failed
branch in configured order. Successful branches are not rolled back.
