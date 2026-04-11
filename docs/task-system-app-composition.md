# Task-System App Composition Guide

The task-system app is the main “real application” example for
`nestjs-yalc`. Its job is not just to work, but to demonstrate the intended
composition style of the framework.

## Architectural goal

The app should be:

- Omni-only for persistence
- CrudGen-first for standard resource CRUD
- explicit about service-layer domain semantics
- explicit about ApiStrategy and EventManager integration

## Resource mapping

Current runtime mapping:

- project/container -> `OmniCollectionEntity`
- task -> `OmniRecordEntity` with `kind = 'task'`
- event -> `OmniRecordEntity` with `kind = 'event'`
- sync-state -> `OmniRecordEntity` with `kind = 'sync-state'`
- external-ref -> `OmniExternalRefEntity`

Canonical semantic relations:

- `contains`
- `references`
- `related_to`

## CRUD surface strategy

Standard CRUD resources should use:

- generated GraphQL via `CrudGenDependencyFactory`
- generated REST via `crudRestControllerFactory`
- app-specific DTOs modeled with `ModelObject` / `ModelField`

Current generated resources:

- `projects`
- `tasks`
- `events`
- `external-refs`
- `sync-states`

The REST e2e suite intentionally covers structured `sorting` and `filters` on
generated controllers backed by Omni services. This is a regression target: if a
resource needs standard list/grid behavior, prefer fixing the framework or the
service override instead of reintroducing manual list controllers.

## Where custom logic lives

### DTO layer

DTOs define the public resource contract:

- field exposure
- relation metadata
- scalar shape for CRUD
- GraphQL naming

### Service layer

Omni-backed services own the semantics:

- entity mapping
- domain validation
- relation synchronization
- semantic write behavior
- structured EventManager errors/logs

Examples:

- projects normalize collection semantics
- tasks synchronize `contains`, `references`, and `related_to`
- events synchronize project membership
- external refs enforce semantic identity behavior

### Relation resolver layer

The app still keeps narrow relation resolvers where that makes the example
clearer and avoids overloading the base CRUD mapper.

Typical examples:

- `task.project`
- `event.project`
- `project.tasks`
- `project.events`

These resolvers are intentionally small and should not grow back into a manual
CRUD layer.

### Manual endpoints

Handwritten controllers are reserved for non-CRUD integration examples:

- ApiStrategy proxy flows
- EventManager logging examples
- EventManager error examples
- domain event demo endpoints

## Why this app matters

The task-system app is both:

- a real example backend
- a framework regression target

That means the app should prefer framework-native patterns over local shortcuts,
so failures in the app expose real composition problems instead of app-specific
boilerplate drift.

## Testing expectations

The app should remain covered by:

- build checks
- REST e2e coverage
- GraphQL e2e coverage

Those checks verify that the generated surface, Omni-backed services, and
integration examples continue to compose correctly.

## Related docs

- [CrudGen-first Composition Guide](./crudgen-first-composition.md)
- [OmniKernel as a CrudGen Backend](./omnikernel-crudgen-backend.md)
- [API Strategy](./api-strategy.md)
- [YalcEventService](./event-manager-service.md)
