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

- `examples/task-system-module`
  - reusable module package
  - entities / DTOs / generated CRUD providers
  - reusable domain module wiring
- `examples/task-system-app`
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
- [x] Create initial scaffold for `examples/task-system-module`
- [x] Create initial scaffold for `examples/task-system-app`
- [x] Open branch/PR for the scaffold work
- [ ] Make `task-system-app` boot successfully
- [ ] Fix `CrudGenDependencyFactory` + `TypeORM` + DI wiring in the YALC-correct way
- [ ] Make the first minimal REST vertical slice work for `projects` and `tasks`
- [ ] Get the initial e2e suite green
- [ ] Commit and push the first bootable/passing version

### Next after vertical slice is green

- [ ] Harden tests (unit + integration + e2e)
- [ ] Add `events` module
- [ ] Add `sync` module and external refs model
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
  - `examples/task-system-app/README.md`
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

### Current blocker

The remaining work is not conceptual anymore; it is **framework-level wiring**.

Current observed blocker family:

- DI / TypeORM / CRUD-gen integration issues in the new standalone example

This is exactly the right place to fix things, because the goal is to make the example align with `nestjs-yalc`'s true intended usage instead of building a fake demo.

## Next concrete actions

1. Inspect the exact expected `CrudGenDependencyFactory` + `TypeOrmModule` wiring path in existing working examples/tests.
2. Fix repository provider registration for the standalone task-system app.
3. Re-run e2e until bootstrap succeeds.
4. Lock the minimal passing vertical slice.
5. Only then expand domain complexity.

## PR strategy

Open a **draft PR** early once the scaffold is in a reviewable state, so progress is visible.

Suggested PR scope:

- docs additions
- task-system example scaffold
- explicit note that wiring/e2e stabilization is in progress if tests are not yet green

## Success criteria

The project is successful when:

- `examples/task-system-app` is runnable standalone;
- it demonstrates correct `nestjs-yalc` patterns;
- it has meaningful e2e coverage;
- it is valuable even without OpenClaw;
- OpenClaw can later extend it without changing its core identity.
