# Task App

This is the advanced composition example. It is a real task-management backend
that exposes generated CrudGen APIs while persisting through OmniKernel.

The app is intentionally Omni-only at runtime:

- projects/containers -> `OmniCollectionEntity`
- tasks -> `OmniRecordEntity` with `kind = 'task'`
- events -> `OmniRecordEntity` with `kind = 'event'`
- sync states -> `OmniRecordEntity` with `kind = 'sync-state'`
- external refs -> `OmniExternalRefEntity`

Canonical relations used by the app:

- `contains` for project membership
- `references` for task cross-links
- `related_to` for loose task associations

## CrudGen-First Composition

Generated CRUD surfaces are used for:

- `projects`
- `tasks`
- `events`
- `external-refs`
- `sync-states`

Each resource is composed with `CrudGenResourceFactory`:

- GraphQL is generated in the app.
- REST is generated in the app.
- service providers are overridden with Omni-backed services.
- dataloaders are overridden where Omni service semantics need to stay shared.

Resource composition files:

- `apps/task-system-app/src/projects/task-project.resource.ts`
- `apps/task-system-app/src/tasks/task-item.resource.ts`
- `apps/task-system-app/src/events/task-event.resource.ts`
- `apps/task-system-app/src/sync/task-external-ref.resource.ts`
- `apps/task-system-app/src/sync/task-sync-state.resource.ts`

## Customization Layers

Manual code is kept below or outside the generated CRUD surface:

- `apps/task-system-app/src/omni-task-app/*` maps task-domain DTOs to
  OmniKernel entities and relation semantics.
- `apps/task-system-app/src/graphql-relations.resolver.ts` keeps relation fields
  explicit where the example wants to show derived relation composition.
- logging, errors, domain events, and API strategy examples remain manual
  because they are not CRUD endpoints.

## Run

```bash
npm run build --prefix examples/task/app
npm run test:e2e --prefix examples/task/app
```

The app starts on Fastify so it can use `NestLocalCallStrategy` through
`fastify.inject()` without a network hop. The task workflow examples use a
module-level API client selected through `ApiCallStrategySelectorProvider`.
The local strategy is the default:

```bash
TASKS_API_STRATEGY=local npm run start --prefix examples/task/app
```

Use the remote HTTP strategy only when the app should call an HTTP endpoint:

```bash
TASKS_API_STRATEGY=http TASKS_HTTP_BASE_URL=http://127.0.0.1:3000 npm run start --prefix examples/task/app
```

## RabbitMQ Event Strategy

The task app also includes an optional RabbitMQ-backed domain event transport.
Local development and the standard e2e suite use the local `EventEmitter2`
strategy unless `TASK_EVENTS_STRATEGY=rabbitmq` is set.

The RabbitMQ branch uses `RabbitMqEventStrategy` from `api-strategy`, composed
with the local `EventEmitter2` strategy:

```text
CompositeEventStrategy(local EventEmitter2, conditional RabbitMQ publish)
```

This keeps in-process handlers active for same-runtime behavior and publishes
the same domain event to RabbitMQ for external consumers when broker publishing
is enabled.

Start the local broker:

```bash
npm run rabbitmq:up --prefix examples/task/app
```

Run the RabbitMQ e2e suite:

```bash
npm run test:e2e:rabbitmq --prefix examples/task/app
```

Stop the broker:

```bash
npm run rabbitmq:down --prefix examples/task/app
```

Runtime configuration:

- `TASK_EVENTS_STRATEGY=local|rabbitmq` selects the event transport. The
  default is `local`.
- `TASK_RABBITMQ_URL` defaults to `amqp://127.0.0.1:5672`.
- `TASK_RABBITMQ_EXCHANGE` defaults to `task-system.events`.
- `TASK_RABBITMQ_QUEUE` defaults to `task-system.audit` for the demo consumer.
- `TASK_RABBITMQ_PUBLISH_ENABLED=false` disables only the RabbitMQ publish
  branch. Local `EventEmitter2` handlers still run.

The RabbitMQ e2e starts the app with `TASK_EVENTS_STRATEGY=rabbitmq`, executes
the same workflow endpoints, verifies local `EventEmitter2` handlers still run,
publishes `task-system.tasks.created` and `task-system.tasks.status-changed`
through RabbitMQ, then consumes them back through a real queue-backed handler.
It also verifies that disabling broker publishing does not disable local
handlers.

## Observability

The task app is also the real-world example for `@nestjs-yalc/observability`.
The app registers `ObservabilityModule` as an opt-in plugin. When enabled, it
listens to EventManager events and exports OpenTelemetry telemetry for:

- task workflow durations
- local and HTTP API strategy calls
- local and RabbitMQ event strategy emits
- EventManager domain events
- HTTP-aware errors raised through `YalcEventService`

Start the local Grafana LGTM stack:

```bash
npm run observability:up --prefix examples/task/app
```

If port `3000` is already used, choose another host port:

```bash
GRAFANA_PORT=3002 npm run observability:up --prefix examples/task/app
```

Run the app with telemetry enabled:

```bash
YALC_OBSERVABILITY_ENABLED=true \
YALC_OTEL_ENDPOINT=http://127.0.0.1:4318 \
PORT=3001 \
TASKS_API_STRATEGY=http \
TASKS_HTTP_BASE_URL=http://127.0.0.1:3001 \
TASK_EVENTS_STRATEGY=rabbitmq \
TASK_RABBITMQ_URL=amqp://127.0.0.1:5672 \
npm run start --prefix examples/task/app
```

Grafana is available at `http://127.0.0.1:3000` by default, or at the
configured `GRAFANA_PORT`. OTLP HTTP is exposed at `http://127.0.0.1:4318`.

For CI and automated tests, use the lightweight Collector stack:

```bash
npm run observability:ci:up --prefix examples/task/app
npm run rabbitmq:up --prefix examples/task/app
npm run test:e2e:observability --prefix examples/task/app
npm run rabbitmq:down --prefix examples/task/app
npm run observability:ci:down --prefix examples/task/app
```

The CI stack writes received telemetry to `examples/task/app/var/otel`, which
is ignored by git. Payload export is disabled by default; enable it only when
the payload is masked and safe for your environment.

## API Strategy Client Pattern

The task module demonstrates the recommended real-world layering:

```text
controller -> workflow service -> module API client -> selected API strategy
```

The controller exposes application workflows under `/task-workflows`. It does
not expose transport details. `TasksApiClient` is exported by the reusable
task-system module package (`examples/task/module/src/client`) and is the only
layer that knows it is calling REST endpoints through `IHttpCallStrategy`. The
app module wires the concrete local and HTTP strategies and selects one stable
client strategy token from configuration.

Workflow endpoints:

- `GET /task-workflows/backlog` lists backlog tasks through the selected
  strategy.
- `POST /task-workflows/project-with-task` creates a project, creates a task
  linked to it, and emits a task-created domain event.
- `PUT /task-workflows/tasks/:id/complete` marks a task as done and emits a
  task-status-changed domain event.
- `GET /task-workflows/projects/:projectId/tasks` lists tasks for a project
  through the selected strategy.

Use this pattern for application code that needs to cross a service boundary:
keep the boundary call inside a typed module client, then keep controllers and
workflow services focused on use cases.

Domain events follow the same idea:

```text
workflow service -> domain events service -> task events client -> selected event strategy
```

`TasksEventsClient` is exported by the reusable task-system module. The app
wires the local `EventEmitter2` strategy and the optional composed
local-plus-RabbitMQ strategy behind one stable `TASK_EVENTS_STRATEGY` token.

## Role In The Examples

Use this app when you want the full framework pattern:

- generated REST and GraphQL
- shared service/repository backend semantics
- OmniKernel as reusable persistence substrate
- service/dataloader override patterns
- API strategy and EventManager integration in real workflows

## API Strategy E2E Coverage

The e2e suite covers both API strategy transports used by the example:

- `NestHttpCallStrategy` configured with `TASKS_API_STRATEGY=http` and
  `TASKS_HTTP_BASE_URL`, then executed
  against the running Nest HTTP server through `/task-workflows`.
- `NestLocalCallStrategy` through a Fastify-backed test app, using
  `fastify.inject()` instead of a network hop. The same workflow endpoints are
  exercised with the default local provider.

The RabbitMQ e2e suite is separate because it requires a local broker. It
verifies the event strategy path with a real exchange, queue binding, publisher,
and consumer handler. CI runs it through the dedicated `Task RabbitMQ example
e2e` job in the examples pipeline.

The observability e2e suite is also separate because it requires Docker. It
starts an OpenTelemetry Collector, exercises the workflow endpoints with
RabbitMQ enabled and disabled, and verifies telemetry for workflows, strategy
wrappers, EventManager events, and errors. CI runs it through the dedicated
`Task observability example e2e` job.
