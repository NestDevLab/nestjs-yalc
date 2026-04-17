# Backend blueprint with `nestjs-yalc`

This document is the short, opinionated playbook for building new backends on top of `nestjs-yalc`.

## Default architectural choices

When starting a new backend, prefer these defaults unless there is a strong reason not to:

- **Use `crud-gen` for API CRUD surfaces** instead of hand-writing repetitive controllers/resolvers/services.
- **Use strategy-based communication between modules/domains** instead of direct provider-to-provider coupling.
- **Use HTTP call strategies for request/response interactions** between modules or services.
- **Use event strategies and `YalcEventService` for async notifications, orchestration, logging, and HTTP-aware errors.**
- **Keep business logic in services/domain modules**, not inside transport-specific adapters.
- **Design modules so they can run in a modular monolith first, and be split later with minimal refactoring.**

## Recommended module boundary rules

For communication across module/domain boundaries:

- Do **not** inject another domain's internal providers directly.
- Expose a client-facing boundary using a strategy token and a client service.
- Start with local/in-process strategies when modules live in the same runtime.
- Switch the same caller token to HTTP strategies when a module becomes remote.

That means your code should depend on:

- `IHttpCallStrategy` for request/response flows
- `IEventStrategy` for event flows
- `YalcEventService` for structured logging and HTTP-aware errors

—not on a concrete transport.

## API generation defaults

For modules exposing CRUD-style resources:

1. Model entities and DTO metadata with `ModelObject` / `ModelField`.
2. Generate providers via `CrudGenDependencyFactory`.
3. Expose GraphQL CRUD resolvers from the generated providers when GraphQL is needed.
4. Expose REST controllers with `crudRestControllerFactory` when REST is needed.
5. Reuse the same generated service/repository layer for both transports.

This keeps REST and GraphQL aligned while avoiding duplicate implementations.

## Communication defaults

### Synchronous calls

Use:

- `NestLocalCallStrategyProvider` when caller and callee live in the same Nest runtime
- `NestHttpCallStrategyProvider` when the callee is remote or must be treated as remote

Wrap each concrete dependency behind its own strategy token. When the transport
can vary by environment, expose one stable caller token with
`ApiCallStrategySelectorProvider` so client services do not change when the app
switches between local and remote transports.

### Asynchronous flows

Use:

- `NestLocalEventStrategyProvider` for in-process async event flows
- `YalcEventService` to emit/log events and to create structured HTTP-aware errors
- `EventStrategySelectorProvider` when event transport may later move from
  local `EventEmitter2` to broker-backed strategies such as RabbitMQ or SNS

Prefer events for:

- domain notifications
- workflow handoffs
- side effects
- observability/logging

Do not use events as a replacement for request/response APIs when the caller needs an immediate result.

## Error handling defaults

Inside Nest modules, prefer `YalcEventService` over raw `HttpException` or `console` usage.

Recommended pattern:

- `errorBadRequest`, `errorNotFound`, `errorConflict`, etc. for HTTP-aware failures
- `errorForward` when propagating or normalizing an upstream/internal error
- `log` / `warn` / `debug` / `verbose` for structured event-backed logging

This keeps logging, event emission, and client-safe error responses aligned.

## Suggested implementation recipe for a new domain

1. Create the domain module and its constants/tokens.
2. Define entities/DTOs and annotate them for `crud-gen`.
3. Generate CRUD providers with `CrudGenDependencyFactory`.
4. Add REST endpoints with `crudRestControllerFactory` if needed.
5. Add GraphQL endpoints from the same generated dependency set if needed.
6. Register outbound strategy providers for every external domain dependency.
7. Create client services that depend on strategy tokens rather than direct imports.
8. Use `YalcEventService` for domain logging/errors/events.

## What to avoid

Avoid these patterns in new code:

- copy-pasted CRUD controllers/services
- direct cross-module service injection
- mixing transport logic with domain logic
- raw `console.*`
- raw Nest HTTP exceptions where `YalcEventService` is the right abstraction
- provider-specific coupling in core business services

## Best starting references in this repository

- `docs/how-to-integrate-nestjs-yalc.md`
- `docs/api-strategy.md`
- `docs/api-creation.md`
- `docs/crud-gen-factory.md`
- `docs/crud-gen-rest.md`
- `docs/event-manager-service.md`
- `docs/error-handling.md`
- `examples/skeleton/app/README.md`

## Practical rule of thumb

If a feature looks like standard CRUD, start from `crud-gen`.
If two modules need to talk, start from a strategy token.
If something must be logged/emitted/thrown coherently, start from `YalcEventService`.
