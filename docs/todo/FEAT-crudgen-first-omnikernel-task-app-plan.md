# FEAT — CrudGen-first OmniKernel + Task App master plan

Status: in progress  
Owner: OpenClaw main session  
Scope: framework-wide refactor/documentation effort, not a narrow task-app patch

## Why this exists

The current OmniKernel/task-app PR proved the Omni-backed behavior can work, but it also showed a framework mismatch:

- too much REST/GraphQL surface was implemented manually
- the integration is not yet **CrudGen-first**
- hidden/under-documented CrudGen capabilities need to be made explicit before designing custom layers

This plan changes the order of work:

1. understand CrudGen deeply
2. document its real capability surface
3. make OmniKernel a first-class CrudGen backend/composition target
4. rebuild task-app around that model

## Target architecture

We want three reference layers, each with a clear role:

### 1) skeleton-app

Purpose:
- show the simplest and most boring/straightforward CrudGen usage
- minimal setup, minimal overrides, minimal framework magic

Target characteristics:
- direct `CrudGenDependencyFactory` wiring
- generated GraphQL CRUD surface via `resolverFactory`
- generated REST surface via `crudRestControllerFactory`
- minimal docs that explain the happy path

### 2) omnikernel-module

Purpose:
- provide a reusable, database-agnostic backend/substrate that can satisfy CrudGen needs
- become the place where the advanced framework composition patterns are demonstrated and documented

Target characteristics:
- supports CrudGen service/repository usage patterns cleanly
- exposes/validates support for:
  - virtual/derived fields
  - joins and relation-aware queries
  - JSON/simple-json fields
  - grid/filter/sort/pagination
  - explicit service override patterns
  - dataloader integration where relevant
- documented as a reusable composition substrate, not just a local example module

### 3) task-system-app

Purpose:
- show a real app composed from CrudGen + OmniKernel
- not a custom CRUD app pretending to be generic

Target characteristics:
- CrudGen-first API surface wherever possible
- Omni-backed services/repositories injected explicitly
- custom code only where domain semantics genuinely exceed generic CRUD
- examples of infra-service communication through API strategies
- examples of event emission/logging/errors through `@nestjs-yalc/event-manager`

## Core implementation principles

- Prefer `CrudGenDependencyFactory`, `resolverFactory`, and `crudRestControllerFactory` over handwritten CRUD surfaces.
- Prefer explicit provider overrides over hidden implicit behavior.
- Keep domain-specific logic in services/repositories/mappers, not in repeated controller/resolver boilerplate.
- Use API strategies wherever possible for infra-service communication.
- Use the event manager consistently for event triggering, logs, and domain-aware errors.
- Keep specs/tests in conventional separated folders, aligned with the rest of the framework.
- Documentation is a deliverable, not an afterthought.

## Initial findings from the audit already started

These are confirmed and should shape the work:

- `CrudGenDependencyFactory` already supports explicit provider override patterns for:
  - resolver
  - service
  - dataloader
  - repository selection
- `resolverFactory` already exposes more flexibility than the task-app currently uses, including:
  - `prefix`
  - `queries`
  - `mutations`
  - `dto`
  - `input`
  - `readonly`
  - `extraArgs`
  - `extraArgsStrategy`
  - `extraInputs`
  - `customQueries`
  - `decorators`
- CrudGen helper internals already expose support paths for:
  - derived/virtual fields (`mode: 'derived'`)
  - relation metadata discovery (`getEntityRelations(...)`)
  - join argument application (`applyJoinArguments(...)`)
  - derived field selection metadata (`applySelectOnFind(...)`)
- Existing docs mention some of this, but not yet in a single, complete, practical narrative that explains how these pieces should be composed together.

## Workstreams

---

## Workstream A — Deep CrudGen audit

Goal:
- fully map what CrudGen can already do before writing more custom framework code

Checklist:
- [ ] Read `crud-gen` core end-to-end enough to map extension points
- [ ] Inventory all factory-level composition surfaces
  - [ ] `CrudGenDependencyFactory`
  - [ ] `resolverFactory`
  - [ ] `crudRestControllerFactory`
  - [ ] service factory / provider token behavior
  - [ ] repository factory behavior
  - [ ] dataloader integration
- [ ] Inventory query capabilities
  - [ ] joins
  - [ ] grid pagination
  - [ ] sorting
  - [ ] filter expressions
  - [ ] extra args
  - [ ] custom queries
- [ ] Inventory write/mutation extension capabilities
  - [ ] extra inputs
  - [ ] middleware hooks
  - [ ] readonly mode
  - [ ] service override patterns
- [ ] Inventory metadata/mapping capabilities
  - [ ] object decorators / model field metadata
  - [ ] derived fields
  - [ ] relation metadata
  - [ ] source/destination field mapping
- [x] Produce a capability matrix: “already supported / partially supported / missing / undocumented”
  - Initial draft created in `docs/todo/FEAT-crudgen-capability-matrix.md`
- [ ] Identify which current task-app custom paths are unnecessary once CrudGen is used properly

Deliverable:
- a written CrudGen capability matrix in docs

---

## Workstream B — CrudGen documentation overhaul

Goal:
- make hidden framework capabilities explicit and teachable

Checklist:
- [x] Review existing docs for overlaps/gaps:
  - [x] `docs/crud-gen-factory.md`
  - [x] `docs/api-creation.md`
  - [x] existing REST/modeling docs reviewed at initial level
- [ ] Add/expand docs for CrudGen composition fundamentals
  - [x] initial CrudGen-first decision guide added to `docs/crud-gen-factory.md`
  - [ ] service override patterns
  - [ ] repository override patterns
  - [ ] dataloader usage
  - [ ] provider token behavior
- [ ] Add/expand docs for advanced GraphQL composition
  - [ ] extra args
  - [ ] extra args strategies
  - [ ] extra inputs
  - [ ] custom queries
  - [ ] readonly usage
- [ ] Add/expand docs for advanced data modeling
  - [ ] derived fields
  - [ ] joins
  - [ ] relation metadata
  - [ ] JSON/simple-json handling
  - [ ] grid/filter/sort patterns
- [ ] Add docs for API strategy integration patterns
  - [x] initial draft note created in `docs/todo/FEAT-crudgen-infra-patterns.md`
- [ ] Add docs for event-manager integration patterns
  - [x] initial draft note created in `docs/todo/FEAT-crudgen-infra-patterns.md`
- [ ] Add docs that explain the intended layering:
  - [ ] skeleton-app = basic
  - [ ] omnikernel = reusable advanced substrate
  - [ ] task-app = real composition example
- [ ] Ensure docs are example-driven and not only API-reference-style

Deliverable:
- framework docs complete enough that a future Omni/task app implementation can be designed from docs, not guesswork

---

## Workstream C — OmniKernel capability hardening for CrudGen

Goal:
- make OmniKernel a truly solid CrudGen composition backend

Checklist:
- [ ] Audit current OmniKernel entities/services/repositories against CrudGen needs
- [ ] Identify gaps for CrudGen compatibility
  - [ ] derived/virtual fields
  - [ ] join semantics
  - [ ] relation traversal
  - [ ] JSON/simple-json field behavior
  - [ ] sorting/filtering/grid support
- [ ] Decide which gaps belong in:
  - [ ] generic Omni services
  - [ ] extended repositories
  - [ ] DTO/model metadata
  - [ ] helper adapters
- [ ] Implement missing support in OmniKernel where justified
- [ ] Add tests for OmniKernel + CrudGen interaction points
- [ ] Add docs showing OmniKernel as a reusable CrudGen backend

Deliverable:
- OmniKernel can support CrudGen-first app composition without forcing app-level manual CRUD surfaces

---

## Workstream D — Task app refactor to CrudGen-first

Goal:
- rebuild task-app as a real composition example, not a manual facade

Checklist:
- [ ] Remove handwritten CRUD REST controllers where CrudGen can replace them
- [ ] Remove handwritten GraphQL CRUD resolvers where CrudGen can replace them
- [ ] Rebuild task-app around `CrudGenDependencyFactory`
- [ ] Use `crudRestControllerFactory` where the path is standard CRUD
- [ ] Use `resolverFactory` where the path is standard GraphQL CRUD/grid
- [ ] Keep custom code only for real domain behavior
  - [ ] Omni mapping logic
  - [ ] semantic relation behavior (`contains`, `references`, `related_to`)
  - [ ] non-generic domain orchestration
- [ ] Ensure task-app stays Omni-only as persistence backend
- [ ] Remove compatibility-shaped shims that exist only because the previous implementation was too manual
- [ ] Reorganize tests/specs into conventional separated folders
- [ ] Update task-app docs to explain its composition model clearly

Deliverable:
- task-app becomes the canonical “real app composed with CrudGen + OmniKernel” example

---

## Workstream E — API strategy + event manager integration

Goal:
- make infra-service communication and event/log/error patterns first-class examples across the apps

Checklist:
- [ ] Audit current usage of API strategies in skeleton/task apps
- [ ] Audit current usage of `@nestjs-yalc/event-manager`
- [ ] Identify missing examples of infra-service client composition
- [ ] Add clear examples in task-app for API strategy-driven communication
- [ ] Ensure task-app shows event manager usage for:
  - [ ] logs
  - [ ] errors
  - [ ] events / domain triggers
- [ ] Align examples so they are idiomatic and reusable, not one-off hacks
- [ ] Document recommended usage patterns

Deliverable:
- task-app demonstrates both CrudGen composition and infra-service/event-manager patterns in a way that teaches the framework

---

## Workstream F — Tests, structure, and review hygiene

Goal:
- make the result framework-grade, not only working

Checklist:
- [ ] Move specs into separated conventional test folders where appropriate
- [ ] Add focused tests for CrudGen composition patterns
- [ ] Add focused tests for OmniKernel + CrudGen support paths
- [ ] Add focused tests for task-app real-world flows
- [ ] Re-run local validation for relevant packages/apps
- [ ] Keep PR description aligned with the new framework-wide scope
- [ ] Split commits logically where useful

## Proposed execution order

1. Workstream A — deep CrudGen audit
2. Workstream B — documentation overhaul baseline
3. Workstream C — OmniKernel capability hardening
4. Workstream D — task-app refactor to CrudGen-first
5. Workstream E — API strategy + event manager examples
6. Workstream F — tests, structure, hygiene

## Definition of done

This effort is done when all of the following are true:

- CrudGen capabilities have been deeply audited and documented
- docs clearly explain the hidden/advanced framework composition paths
- OmniKernel is a credible reusable CrudGen backend/substrate
- task-app uses CrudGen-first composition wherever possible
- task-app remains Omni-only for persistence
- task-app demonstrates API strategy + event manager patterns meaningfully
- specs are structurally aligned with framework conventions
- the resulting PR is both functionally green and architecturally aligned

## Current status notes

- [x] master plan/checklist created
- [x] initial CrudGen capability inventory started
- [x] initial capability matrix drafted
- [ ] deep source audit still in progress
- [ ] docs overhaul in progress (initial matrix + decision-guide pass started)
- [ ] OmniKernel hardening not started yet
- [ ] task-app CrudGen-first refactor not started yet
- [ ] API strategy/event-manager integration pass not started yet
- [ ] spec-folder normalization not started yet
