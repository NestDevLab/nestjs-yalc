# OmniKernel as a CrudGen Backend

OmniKernel should be understood as a reusable persistence substrate for
CrudGen-first applications, not as a reason to abandon generated CRUD layers.

This guide explains the intended split of responsibilities between OmniKernel
and the applications built on top of it.

## OmniKernel’s role

OmniKernel already provides:

- CrudGen-native backend registration for services and dataloaders
- optional generated GraphQL registration for compatibility
- DTOs modeled with `ModelObject` / `ModelField`
- relation-aware entities
- payload-oriented records/documents/collections
- service overrides for resource-specific semantics

That makes it suitable as a backend substrate for more specialized apps such as
the task-system app.

## Target usage model

An app using OmniKernel should ideally look like this:

1. app-specific DTOs define the CRUD contract
2. generated GraphQL and REST surfaces expose that contract
3. Omni-backed services translate the contract into Omni storage semantics
4. repository/query overrides fill read-side gaps when needed

The application should not compensate with extra handwritten CRUD surface code
unless the contract is genuinely non-generic.

## What belongs in OmniKernel

Reusable OmniKernel concerns include:

- canonical modeling patterns for:
  - collections
  - records
  - documents
  - relations
  - external references
- service helpers for semantic write behavior
- repository/query helpers for relation-aware traversal
- DTO metadata patterns for:
  - relation metadata
  - JSON-backed fields
  - derived fields

OmniKernel can expose generated GraphQL providers for compatibility, but new
apps should prefer importing it as a substrate and composing their public API
surface explicitly.

## What should stay in apps

Application-specific concerns include:

- domain naming and contract choices
- app-specific invariants
- orchestration flows
- provider-specific sync behavior
- non-CRUD endpoints

OmniKernel should support those apps, not absorb their entire public API.

## Recommended modeling pattern

For Omni-backed apps:

- expose app-specific DTOs, not raw Omni entities
- map DTO inputs to Omni entities in a dedicated mapper/service layer
- keep the base CRUD DTO scalar-first
- resolve relations through metadata or narrow relation resolvers
- keep semantic edge handling in services

## Relations and semantic edges

OmniKernel can model both generic relations and app-level semantic edges.

Typical examples:

- `contains`
- `references`
- `related_to`

The CRUD contract does not need to know every internal detail of relation
synchronization. Generated CRUD can stay stable while services maintain the
actual relation graph.

## JSON and payload-backed fields

Payload-backed storage is useful, but it should not become an excuse for opaque
contracts.

Recommended approach:

- expose stable DTO fields for the values the app truly cares about
- keep raw payloads internal unless they are part of the public contract
- use service/repository logic to project payload values into DTO fields
- document clearly which fields are queryable and which are opaque

## Derived fields

Derived fields should be used when they improve the public contract without
duplicating stored state.

Use them for:

- normalized labels
- computed projections
- backend-specific payload transformations

If a derived field must support richer filtering or sorting semantics, solve
that below the API surface in the query/repository layer.

## Decision rule for Omni-backed apps

If an Omni-backed resource still looks like CRUD from the client perspective:

- keep GraphQL generated
- keep REST generated
- customize the service and repository layers

If it no longer looks like CRUD:

- add narrow custom endpoints for the non-CRUD operations only

## Reference example

The reusable substrate example is the OmniKernel app:

- [examples/omnikernel/app/README.md](../examples/omnikernel/app/README.md)

It exposes the raw OmniKernel resource set through generated REST controllers
and generated GraphQL resolvers over the same in-memory persistence surface. The
app imports the backend-only OmniKernel module and composes REST and GraphQL
with `CrudGenResourceFactory`, so the API surface is owned by the app while the
backend providers stay reusable.

The strongest current real composition example is the task-system app:

- [examples/task/app/README.md](../examples/task/app/README.md)

It demonstrates how projects, tasks, events, sync states, and external refs can
all stay CrudGen-first while using OmniKernel as the runtime persistence model.
