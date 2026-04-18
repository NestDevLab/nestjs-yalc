# API Strategy and EventManager Integration Patterns

`api-strategy` and `event-manager` are not optional add-ons in the example
applications. They are the recommended way to keep transport concerns and
structured operational behavior out of domain CRUD code.

This guide describes the intended split.

## Principle

Use:

- **CrudGen** for standard resource CRUD contracts
- **ApiStrategy** for service-to-service communication
- **YalcEventService** for logs, domain events, and HTTP-aware errors

These three tools solve different problems and should not replace one another.

## When to use ApiStrategy

Use ApiStrategy when a module or app needs to call another service boundary.

Typical examples:

- typed module clients that call another HTTP surface
- local in-process calls in development
- swappable transport per environment

Recommended pattern:

1. keep CRUD controllers/resolvers focused on resource behavior
2. inject a typed module client for cross-boundary calls
3. keep the transport implementation behind a provider token
4. when multiple transports are valid, expose one stable caller token through
   `ApiCallStrategySelectorProvider`

This allows the same application logic to move between:

- local-call transport
- HTTP transport
- event transport

without changing the caller contract.

Use selector providers for app-level configuration such as local development
versus remote deployment. Register each concrete strategy under its own token,
then expose one final token to consumers:

```ts
ApiCallStrategySelectorProvider({
  provide: TASKS_CLIENT_API_STRATEGY,
  defaultStrategy: 'local',
  strategies: {
    local: TASKS_CLIENT_LOCAL_API_STRATEGY,
    http: TASKS_CLIENT_HTTP_API_STRATEGY,
  },
  selector: {
    useFactory: () => process.env.TASKS_API_STRATEGY,
  },
});
```

The same selector shape applies to `IEventStrategy` via
`EventStrategySelectorProvider`. The built-in local event strategy uses
`EventEmitter2` for same-runtime handlers. `NestRabbitMqEventStrategy` keeps
that local `EventEmitter2` emission and also publishes the event to RabbitMQ,
so the app can support internal runtime events and external broker consumers
through the same strategy call.

The task-system app demonstrates this with `TasksEventsClient`:

```text
workflow service -> domain events service -> task events client -> selected event strategy
```

The app keeps `local` as the default event transport and exposes RabbitMQ as an
optional local-plus-remote strategy selected with
`TASK_EVENTS_STRATEGY=rabbitmq`. This keeps the workflow code independent from
the broker while still allowing an e2e suite to exercise local handlers plus a
real exchange, queue binding, publisher, and consumer.

## When to use YalcEventService

Use `YalcEventService` whenever the code needs:

- structured logging
- domain event emission
- safe HTTP-aware errors
- consistent error forwarding

Recommended pattern:

- service-layer validation errors should use `errorBadRequest`, `errorNotFound`,
  and related helpers
- operational or domain events should go through `log`, `logAsync`,
  `emit`, or `emitAsync`
- avoid raw `console` and avoid ad-hoc `HttpException` usage in framework
  examples

## How this combines with CrudGen-first apps

In a CrudGen-first app:

- generated GraphQL/REST surfaces stay thin
- workflow services implement the business behavior
- ApiStrategy lives behind typed module clients
- YalcEventService is used inside those services for logs/events/errors

This keeps the CRUD surface generic while the operational behavior remains
explicit and testable.

## Task-system app examples

The task-system app intentionally keeps several non-CRUD endpoints to show
these patterns:

- `/task-workflows/*` endpoints for ApiStrategy usage through `TasksApiClient`
  exported by the task-system module package
- logging endpoints for EventManager usage
- error endpoints for HTTP-aware EventManager errors
- domain event demo endpoints

The workflow endpoints combine strategy-backed calls and domain events:

- `POST /task-workflows/project-with-task` creates resources through the
  selected strategy and emits `task-system.tasks.created`.
- `PUT /task-workflows/tasks/:id/complete` updates through the selected strategy
  and emits `task-system.tasks.status-changed`.

By default these events are handled through local `EventEmitter2`. For a
local-plus-broker run, start the task app RabbitMQ compose file and run:

```bash
npm run rabbitmq:up --prefix examples/task/app
npm run test:e2e:rabbitmq --prefix examples/task/app
npm run rabbitmq:down --prefix examples/task/app
```

That suite sets `TASK_EVENTS_STRATEGY=rabbitmq` and verifies that workflow
domain events still reach local `EventEmitter2` handlers, are published to
RabbitMQ, and are consumed back by the task app's queue-backed handler.

Those endpoints are examples of integration behavior. They are intentionally
separate from generated CRUD resources.

## Recommended decision rule

If the behavior is:

- resource CRUD -> keep it in CrudGen
- cross-service communication -> use ApiStrategy, with selector providers when
  the transport is configurable
- log/error/event behavior -> use YalcEventService

If all three are mixed into one controller/resolver method, the layering is
usually wrong.
