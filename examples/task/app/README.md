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

## Role In The Examples

Use this app when you want the full framework pattern:

- generated REST and GraphQL
- shared service/repository backend semantics
- OmniKernel as reusable persistence substrate
- service/dataloader override patterns
- API strategy and event manager integration in a real app
