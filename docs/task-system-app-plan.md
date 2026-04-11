# Task System App Plan

## Goal

Build a **standalone, real-world task management backend** inside `nestjs-yalc` that:

- is usable on its own;
- serves as a serious demo/reference app for `nestjs-yalc`;
- becomes a CI/CD target for unit, integration, and e2e tests;
- stays fully independent from OpenClaw;
- can later be consumed and extended by an OpenClaw-side app.

## Non-negotiable constraints

For this project, use only patterns and building blocks already aligned with `nestjs-yalc`:

- CRUD APIs via `crud-gen`
- REST via `crudRestControllerFactory`
- module communication via strategy providers
- logging / errors / event flows via `YalcEventService` and `event-manager`
- no custom parallel architecture outside `nestjs-yalc`
- no OpenClaw coupling inside the `nestjs-yalc` example app

## High-level architecture

### Inside `nestjs-yalc`

Create a standalone app composed of:

- `examples/task/module`
  - reusable module package
  - entities / DTOs / generated CRUD providers
  - reusable domain module wiring
- `examples/task/app`
  - runnable Nest app
  - REST surfaces
  - strategy-based internal communication examples
  - event-manager usage examples
  - test target for CI/CD

### Outside `nestjs-yalc`

OpenClaw later becomes:

- consumer
- orchestrator
- assistant UX layer

But **not** part of this example app.

## Functional scope for v1

### Core modules

1. `projects`
   - create/update/delete/list projects
   - basic lifecycle and status

2. `tasks`
   - create/update/delete/list tasks
   - task status
   - optional due date
   - link to project

3. `events` *(after first vertical slice)*
   - separate from tasks
   - true scheduled items

4. `sync` *(after core CRUD works)*
   - external refs
   - sync state
   - provider-agnostic metadata

## Domain rules

- Task and Event are distinct concepts.
- Internal IDs are canonical.
- External provider IDs must never become domain IDs.
- Provider-specific semantics stay out of the core model.
- The app must work even if no external consumer exists.

## Implementation checklist

Keep this checklist updated while implementing. Mark items as `[x]` when completed, add sub-items when needed, and adjust wording only if scope really changes.

### Active now

- [x] Define architecture and constraints for a standalone `task-system-app`
- [x] Add planning/documentation files to the repo
- [x] Create initial scaffold for `examples/task/module`
- [x] Create initial scaffold for `examples/task/app`
- [x] Open branch/PR for the scaffold work
- [x] Make `task-system-app` boot successfully
- [x] Fix `CrudGenDependencyFactory` + `TypeORM` + DI wiring in the YALC-correct way
- [x] Make the first minimal REST vertical slice work for `projects` and `tasks`
- [x] Get the initial e2e suite green
- [x] Make the example build cleanly in addition to passing e2e
- [x] Commit and push the first bootable/passing version

### Next after vertical slice is green

- [ ] Harden tests (unit + integration + e2e)
  - [x] add initial focused unit tests for task/project domain event services
  - [ ] add deeper integration coverage around event-manager/module wiring
- [x] Add `events` module
- [x] Add `sync` module and external refs model
- [x] Refactor `sync` into `ExternalRef` + `SyncState`
- [x] Add full GraphQL coverage
  - [x] expose GraphQL CRUD for `projects`
  - [x] expose GraphQL CRUD for `tasks`
  - [x] expose GraphQL CRUD for `events`
  - [x] expose GraphQL CRUD for `sync`
  - [x] add GraphQL integration/e2e tests for all exposed slices
- [ ] Add GraphQL capability coverage for distinctive YALC features
  - [x] join coverage (validated on actual supported GraphQL join args / enum values)
  - [x] virtual field coverage
    - [x] framework-level coverage for derived-field hydration / selection / denyFilter behavior
    - [x] example-level GraphQL e2e read coverage for derived field (`fullName`)
    - [ ] optional future expansion: sorting/filtering semantics on derived fields where supported by repository path
  - [ ] JSON field coverage with nested property access
    - [ ] deferred: current `task-system` example does not expose a dedicated JSON-backed CRUD model yet
    - [ ] when added, cover JSON scalar round-trip (create/read/update)
    - [ ] when added, cover JSON exposure on GraphQL grids
    - [ ] when added, probe nested dot-path sorting/filtering semantics honestly
  - [ ] GraphQL filtering/sorting/pagination coverage beyond baseline CRUD
    - [x] sorting coverage on task grids
    - [ ] filtering coverage (blocked in this example because plain-repository fallback now fails explicitly on structured filters; needs extended repository path to test end-to-end)
    - [x] pagination coverage on grid queries
  - [x] GraphQL error behavior coverage for advanced queries
- [ ] Improve `nestjs-yalc` documentation whenever capability discovery reveals missing or unclear feature docs
- [ ] Add `areas` / `inbox` if still justified after core domain stabilizes
- [ ] Integrate the example into repo CI/CD checks
- [ ] Prepare the external OpenClaw-side integration layer separately

## Delivery phases

### Phase 0 — foundation and docs

Already started:

- clone repo locally
- inspect framework conventions
- add documentation:
  - `docs/backend-blueprint.md`
  - `examples/task/app/README.md`
  - this plan file

### Phase 1 — first runnable vertical slice

Target:

- standalone app boots
- SQLite works
- REST CRUD works for:
  - projects
  - tasks
- one strategy-based internal flow works
- one `YalcEventService`-based error/log flow works

Implementation pieces:

- task-system module package
- task-system app package
- TypeORM wiring
- CRUD-gen provider generation
- REST controllers via factory
- bootstrap app
- first e2e suite

### Phase 2 — stabilize framework-consistent wiring

Current blocker area:

- correct `CrudGenDependencyFactory` + TypeORM + module wiring for a standalone app
- ensure repository/service/dataloader generation works in the exact intended `nestjs-yalc` way
- remove accidental assumptions copied from partial examples

Definition of done:

- app boots without DI errors
- e2e tests pass for the initial CRUD flow

### Phase 3 — strengthen test value

Add:

- unit tests for service logic and mapping
- integration tests for module wiring
- e2e tests for:
  - CRUD lifecycle
  - strategy-based internal calls
  - event-manager logging/errors

Goal:

Make this app a real regression target for `nestjs-yalc`.

### Phase 4 — extend the domain

Add progressively:

- `events`
- `areas`
- `inbox`
- `sync`
- external refs and provider-agnostic sync metadata

### Phase 5 — CI/CD integration in repo

Add repository-level checks so this app validates:

- build correctness
- CRUD-gen regressions
- event-manager regressions
- strategy regressions
- end-to-end correctness

## Current status

### Done

- initial scaffold created
- docs updated
- standalone example structure added
- first REST/controller/test scaffolding written
- first real e2e run attempted
- bootstrap/DI wiring fixed for the initial vertical slice
- example now boots, builds, and passes its initial e2e suite
- the first bootable/passing version has been committed and pushed

### Current blocker

The original DI/bootstrap blocker has been resolved for the initial vertical slice.

Current observed blocker family:

- build/webpack/TypeScript pathing issues for the standalone example when compiling against `@nestjs-yalc/*` source packages in the monorepo
- some remaining app-specific type mismatches are being cleaned up while preserving the YALC patterns

The runtime/e2e slice is now working and the example now builds cleanly as well; the remaining work is to harden and extend it further.

## Next concrete actions

1. Add more focused unit/integration coverage around the working slice.
2. Harden `event-manager` usage and per-module logging configuration where appropriate.
3. Add explicit domain events for `tasks` and `projects` where useful.
4. Only then expand domain complexity (`events`, `sync`, etc.).

### Newly completed

- [x] add first standalone `events` slice (entity/DTO/module/REST/e2e)
- [x] add first standalone `sync` slice (entity/DTO/module/REST/e2e)
- [x] refactor `sync` into `ExternalRef` + `SyncState`

### Next implementation target

- Build a GraphQL capability matrix for the features that make `nestjs-yalc` valuable beyond plain CRUD.
- Start with the most framework-distinctive coverage: joins/relations, virtual fields, and JSON field access.
- Keep growing the sync model only through conceptually separate domain pieces.
- Delay provider-specific Google integration until the generic sync domain is strong enough.
- Separate **external mapping/identity** from **operational sync state**.
- Keep the sync domain provider-agnostic before touching provider-specific Google integration.
- Continue implementing incrementally on top of these correct domain boundaries.

### In progress notes

- `event-manager` has been extended beyond demo/error endpoints toward module-specific domain event emission for `tasks` and `projects`.
- The example app now supports standalone CRUD slices for `projects`, `tasks`, `events`, and `sync` references.
- The next hardening step after this is to reduce duplicated setup and add more focused integration tests around event/logging/sync wiring.

## PR strategy

Open a **draft PR** early once the scaffold is in a reviewable state, so progress is visible.

Suggested PR scope:

- docs additions
- task-system example scaffold
- explicit note that wiring/e2e stabilization is in progress if tests are not yet green

## Success criteria

The project is successful when:

- `examples/task/app` is runnable standalone;
- it demonstrates correct `nestjs-yalc` patterns;
- it has meaningful e2e coverage;
- it is valuable even without OpenClaw;
- it has meaningful e2e coverage;
- it is valuable even without OpenClaw;
- OpenClaw can later extend it without changing its core identity.
