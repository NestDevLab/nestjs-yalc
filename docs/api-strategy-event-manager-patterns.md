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

- HTTP proxy calls
- local in-process calls in development
- swappable transport per environment

Recommended pattern:

1. keep CRUD controllers/resolvers focused on resource behavior
2. inject a strategy-backed service for cross-boundary calls
3. keep the transport implementation behind a provider token

This allows the same application logic to move between:

- local-call transport
- HTTP transport
- event transport

without changing the caller contract.

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
- services implement the business behavior
- ApiStrategy lives beside or below services that need remote/local transport
- YalcEventService is used inside those services for logs/events/errors

This keeps the CRUD surface generic while the operational behavior remains
explicit and testable.

## Task-system app examples

The task-system app intentionally keeps several non-CRUD endpoints to show these
patterns:

- proxy endpoints for ApiStrategy usage
- logging endpoints for EventManager usage
- error endpoints for HTTP-aware EventManager errors
- domain event demo endpoints

Those endpoints are examples of integration behavior, not examples of how CRUD
resources should be exposed.

## Recommended decision rule

If the behavior is:

- resource CRUD -> keep it in CrudGen
- cross-service communication -> use ApiStrategy
- log/error/event behavior -> use YalcEventService

If all three are mixed into one controller/resolver method, the layering is
usually wrong.
