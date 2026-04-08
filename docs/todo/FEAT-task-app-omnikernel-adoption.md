# Task App OmniKernel Adoption

## Audience

This document is written for another AI agent that will implement the next PR
after the OmniKernel PR is merged.

The goal of that next PR is not to keep expanding OmniKernel itself. The goal is
for the task application to start consuming OmniKernel as its storage and graph
substrate.

## Preconditions

Before starting the task-app adoption PR, assume the OmniKernel PR has already
been merged. That PR now provides:

- shared records through `OmniRecordEntity`
- concrete documents through `OmniDocumentEntity`
- concrete collections through `OmniCollectionEntity`
- canonical collection membership semantics through `contains`
- typed external references through `OmniExternalRefInternalType`
- workflow helpers through `OmniExternalRefService`
- higher-level traversal helpers through `OmniKernelQueryService`

Important repo note:

- in the current workspace snapshot, `examples/task-system-app` only exposes
  built output under `dist/`, not the original source tree
- before making code changes, locate the real task-app source or restore it in
  the next PR branch
- do not try to implement the adoption by editing built `dist` output

## Goal

Adopt OmniKernel inside the task application in a way that is incremental,
reviewable, and reversible.

That means:

- do not rewrite the task app all at once
- do not delete the existing task model in the first adoption PR
- introduce an adapter layer first
- move the task app toward OmniKernel-backed reads/writes behind explicit
  services

## Non-Goals

The task-app adoption PR should not:

- redesign OmniKernel foundations again unless a real blocker is discovered
- invent a second generic graph model next to OmniKernel
- collapse task-app migration, legacy cleanup, and feature expansion into one
  change set
- replace every task-app endpoint in a single step if an adapter path is
  cleaner

## Recommended Mapping

Use these mappings unless the task app source reveals a hard contradiction.

### Core mapping

- task item -> `OmniRecordEntity`
- project / board / backlog / container -> `OmniCollectionEntity`
- long-form task note or rich attached text -> `OmniDocumentEntity`
- external tracker mapping -> `OmniExternalRefEntity`

### Why tasks should start as records, not documents

Use `OmniRecordEntity` for tasks in the first adoption PR.

Reasons:

- current OmniKernel already supports generic record kinds cleanly
- current document subtype semantics are still content-oriented
- task adoption should not require inventing a new Omni document subtype before
  the first integration lands
- if the task app later needs richer task-specific fields, it can still evolve
  toward a dedicated Omni child entity in a later PR

So the default starting point should be:

- `kind = 'task'` for task records
- `status` mapped into Omni record status or task payload, depending on how much
  fidelity is needed
- task-specific fields placed in `payload`

### Collection mapping

Use `OmniCollectionEntity` for grouping structures such as:

- project
- board
- list / bucket / backlog

Use:

- `kind = 'collection'`
- `collectionKind` to differentiate container styles where useful
- `title`, `slug`, `externalId`, and `summary` for the human-facing container
  identity

### Relation mapping

Use these relation rules in the task-app PR:

- collection -> task: `contains`
- collection -> document: `contains`
- task -> task cross-link / dependency placeholder: `references`
- loose association: `related_to`

Do not introduce `belongs_to` in the task-app PR.

Why:

- OmniKernel already treats direction as the inverse meaning
- `contains` from container to member is the canonical organization edge
- adding a mirrored inverse too early increases redundancy in both writes and
  queries

If the task app needs stronger dependency semantics such as `blocked_by` or
`parent_of`, add them explicitly in the task-app PR only if there is a concrete
read/write path that uses them.

## Migration Strategy

Adopt OmniKernel in phases.

### Phase 1 — Source of truth adapter

Create a task-app adapter service that maps between task-app concepts and
OmniKernel concepts.

This service should:

- translate task-app writes into Omni record / collection / relation writes
- translate Omni reads back into task-app response shapes when needed
- isolate mapping rules from controllers/resolvers

The first PR should prefer a dedicated adapter service over changing many
controllers directly.

### Phase 2 — Container migration

Move project / board / backlog-like entities to Omni collections.

Expected shape:

- create collections for the task app containers
- express task membership with collection `contains` relations
- use `OmniKernelQueryService.getCollectionMembers(...)` for read paths where it
  helps simplify container queries

### Phase 3 — Task migration

Move task records into Omni records.

Expected shape:

- create Omni records with `kind = 'task'`
- place task-specific fields in `payload`
- keep human-facing identity in `title`, `slug`, and optional `externalId`

At this phase, the task app can still keep legacy tables if dual-read or
backfill is needed.

### Phase 4 — External tracker migration

Move external tracker identifiers into Omni external refs.

Use:

- `internalType = record` for task records in the first task-app PR
- `provider` for the external system name
- `account` and `container` when needed for provider scoping
- `externalId` for the provider-native identifier

Use `OmniExternalRefService` helper methods for:

- upsert by provider/account/container/external identity
- lookup of refs for a specific internal task record

### Phase 5 — Read-path switchover

Only after the adapter layer is stable:

- switch task-app queries to read from OmniKernel-backed services
- keep the externally visible API stable where possible
- avoid mixing task-app controller changes with storage-layer experimentation in
  the same commit when possible

## Concrete Implementation Guidance

### Introduce a task-app adapter module

Create a small task-app module or service group dedicated to OmniKernel
integration.

Responsibilities:

- task-to-Omni mapping
- collection membership writes
- dependency/reference writes
- external-ref sync helpers
- read-path assembly for task views

### Prefer explicit mapping functions

Add small explicit functions rather than burying mapping logic in controllers.

Examples:

- `mapTaskToOmniRecord(...)`
- `mapProjectToOmniCollection(...)`
- `mapTrackerRefToExternalRef(...)`
- `mapOmniRecordToTaskView(...)`

### Keep task payload disciplined

The first task-app PR should not turn Omni `payload` into an unstructured dump.

Recommended payload categories:

- task domain fields that do not deserve top-level Omni fields yet
- task-specific status or flags if they do not map 1:1 to Omni status
- due dates, assignee hints, priority, labels, etc.

Do not duplicate fields already modeled by Omni top-level fields.

### Avoid premature Omni child entities

Do not introduce `OmniTaskEntity` in the first adoption PR unless the task app
source clearly requires it.

The first adoption goal is integration, not final perfect task modeling.

## Validation Checklist For The Task-App PR

The next AI should not consider the task-app adoption PR done unless all of
these are true:

- task-app source changes are made against real source files, not `dist/`
- OmniKernel is imported as a dependency instead of being duplicated locally
- container membership uses canonical `contains` relations
- external tracker mappings use `OmniExternalRefEntity`
- at least one real task-app read path uses OmniKernel-backed queries
- at least one real task-app write path persists into OmniKernel
- tests cover the adapter mapping layer
- tests cover at least one collection membership flow
- tests cover at least one external-ref sync flow
- repo validation is run again after the task-app PR changes

## Definition Of Done For The Task-App Adoption PR

The task-app adoption PR is done when:

- the task app has a real OmniKernel-backed path for tasks and containers
- the migration direction is obvious from the codebase
- the adapter layer is explicit and reviewable
- no duplicate parallel graph model is introduced
- task-app integration remains a separate concern from further OmniKernel core
  expansion

## Suggested PR Scope

Keep the next PR focused on this order:

1. restore or locate the real task-app source tree
2. add the task-app OmniKernel adapter layer
3. map containers to Omni collections
4. map tasks to Omni records
5. wire external tracker refs to Omni external refs
6. switch one or more read/write paths to OmniKernel
7. add tests and documentation

If the PR starts growing beyond that, split follow-up cleanup into another PR
instead of broadening the task-app adoption branch further.
