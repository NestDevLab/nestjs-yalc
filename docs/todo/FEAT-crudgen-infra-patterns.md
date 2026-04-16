# FEAT — CrudGen-first infra patterns (API strategy + event manager)

Status: draft / in progress  
Related plan: `docs/todo/FEAT-crudgen-first-omnikernel-task-app-plan.md`

## Purpose

This note captures the intended pattern for combining:

- generated CrudGen API surfaces
- custom service/repository/domain logic
- API strategy clients for infra-service communication
- `@nestjs-yalc/event-manager` for logs, events, and structured errors

The goal is to make these systems feel like one architecture, not separate optional tools.

---

## Core idea

Generated CRUD surfaces should stay thin.

That means:
- generated GraphQL/REST handles transport, DTO exposure, pagination/grid/query conventions
- service/repository layers handle persistence and domain orchestration
- service layer is the preferred place to invoke:
  - API strategy clients
  - event manager logs/events/errors

This preserves CrudGen-first architecture while still allowing rich real-world behavior.

---

## What the examples already show

### Skeleton app

Current evidence from `examples/skeleton-app/apps/skeleton-app/src/users/users.module.ts`:

- `SkeletonModule.register('default')` provides the CRUD surface
- `UsersApiClient` from `examples/skeleton/module` shows typed module-client
  calls through a selected API strategy
- `ApiCallStrategySelectorProvider` exposes a stable
  `USERS_CLIENT_API_STRATEGY` token while the app wires local and HTTP
  strategies
- `EventModule.forRootAsync()` + event emitter setup shows event-manager wiring in an app module

This proves the framework already supports placing CrudGen and infra-service patterns in the same app, but the pattern is not yet documented explicitly.

### Task app domain-event helpers

Current evidence from task-app service helpers:

- `TasksDomainEventsService`
- `ProjectsDomainEventsService`

These already show a useful event-manager usage style:

- `events.log([...], { message, data, event, eventAliases, logger })`

This is a good building block for the final task-app design because a single instruction can:
- log
- emit domain events
- attach structured data
- keep logger integration consistent

---

## Recommended composition pattern

## 1) Module level

A CrudGen-first app/module should typically wire:

- generated CrudGen providers (`CrudGenDependencyFactory`)
- generated REST controller(s) (`crudRestControllerFactory`) where needed
- `EventModule`
- one or more API strategy providers (`NestHttpCallStrategyProvider`, local strategies, etc.)
- small domain helper services for orchestration

## 2) Resolver/controller level

Generated layers should remain transport-focused.

They should usually **not**:
- build HTTP clients directly
- emit domain events directly
- implement cross-service orchestration directly
- perform rich domain validations inline when a service can own them

Instead, they should delegate to service overrides.

## 3) Service level

Service override is the preferred place for:

- translating DTO/write models into persistence models
- coordinating repository writes
- calling API strategies for dependent services
- emitting domain logs/events through `YalcEventService`
- raising consistent domain/HTTP errors through the event manager error helpers

## 4) Repository level

Repository overrides should focus on:

- query semantics
- joins
- filtering/sorting support
- persistence-specific behavior
- backend-specific optimization

Repositories should avoid becoming transport-aware or event-aware.

---

## Event-manager usage guidance

### Use event manager for more than logging

`YalcEventService` should be treated as the default structured mechanism for:

- domain logs
- domain events
- error creation/throwing
- logger integration

### Preferred usage pattern

In service code, prefer patterns like:

- `events.log(...)` when the operation should log and optionally emit
- `events.error...(...)` when the operation should create a structured domain-aware error

This keeps:
- event naming predictable
- logger usage centralized
- error formatting/status handling consistent across apps

### Why this matters for task-app

Task-app is supposed to be a real example app, so it should demonstrate:

- project/task/event lifecycle logging
- semantic event aliases
- structured error creation
- not just ad-hoc `throw new Error(...)`

---

## API strategy usage guidance

### Use strategy providers as clients, not as framework decoration

An app should register explicit strategy providers such as:

- HTTP strategy clients
- local-call strategy clients
- local-event strategy clients

and then inject them into service orchestration layers.

### Preferred usage pattern

- module registers a named strategy provider
- service injects the strategy token/client
- service uses it to perform infra-service communication as part of domain logic

### Why this matters for task-app

Task-app should become the place where we show:

- intelligent intra-framework service communication
- not only direct repository writes
- practical orchestration examples alongside generated CRUD surfaces

Examples might include:
- sync-related external service calls
- notifications/logging side effects
- local event-driven follow-up actions

---

## Design rule for real apps

When a real app needs more than plain CRUD:

1. keep generated CrudGen surface if the public contract is still CRUD-like
2. override service/repository for domain behavior
3. inject API strategy clients into the service layer
4. use event manager for logs/events/errors
5. only handwrite resolver/controller methods for genuinely non-generic operations

---

## Implication for the task-app refactor

Task-app should eventually demonstrate all of the following together:

- CrudGen-generated GraphQL CRUD/grid where possible
- CrudGen-generated REST CRUD where possible
- OmniKernel-backed service/repository behavior underneath
- API strategy clients for real infra-service communication
- event-manager-based logs/errors/events in the same service layer

That combination is the actual target example value of the app.

---

## Next doc follow-up

This draft should eventually become a proper framework doc (not only a todo note), ideally linked from:

- `docs/api-creation.md`
- `docs/crud-gen-factory.md`
- task-app docs
