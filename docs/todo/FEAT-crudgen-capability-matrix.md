# FEAT — CrudGen capability matrix (initial audit)

Status: draft / in progress  
Related plan: `docs/todo/FEAT-crudgen-first-omnikernel-task-app-plan.md`

## Purpose

This document captures what CrudGen can already do today, what is only partially documented, and what OmniKernel/task-app should adapt to instead of bypassing with handwritten CRUD surfaces.

The goal is to avoid building custom REST/GraphQL code when the framework already supports the behavior through factory composition.

---

## Summary

Initial conclusion from the audit:

- CrudGen is **more capable than the current task-app integration is using**.
- The framework already supports a large portion of what we need for a CrudGen-first OmniKernel composition.
- The main problems are currently:
  - missing/fragmented documentation
  - insufficient OmniKernel-aligned examples
  - task-app taking a manual path too early

---

## Capability matrix

| Area | Capability | Current support | Current documentation | Evidence / notes | Implication for OmniKernel / task-app |
|---|---|---:|---:|---|---|
| Core composition | `CrudGenDependencyFactory` creates resolver/service/dataloader/repository wiring | ✅ | ⚠️ partial | `crud-gen.helpers.ts`, `crud-gen/README.md`, `docs/api-creation.md` | Task-app should use this as the primary composition entry point |
| Core composition | Explicit provider override for resolver | ✅ | ⚠️ partial | `CrudGenDependencyFactory` provider override shape; `examples/skeleton-module/src/skeleton-user.resolver.ts` | Custom resolver should be used only when extending generated behavior, not replacing all CRUD by hand |
| Core composition | Explicit provider override for service | ✅ | ⚠️ partial | `skeleton-user.resolver.ts` uses `useClass` service override | Omni-backed services should plug in here first |
| Core composition | Explicit dataloader configuration | ✅ | ⚠️ partial | `dataloader: { databaseKey: 'guid' }` used in examples | Omni entities should keep dataloader-friendly keys and relation loading patterns |
| Core composition | Explicit repository selection / extended repository path | ✅ | ⚠️ partial | `crud-gen/README.md`, helper/provider plumbing | Important for OmniKernel when standard repo behavior is insufficient |
| GraphQL generation | Generated get-single query | ✅ | ✅ | `resolverFactory`, docs in `api-creation.md` | Task-app should not handwrite standard `getById` resolvers |
| GraphQL generation | Generated grid query | ✅ | ✅ | `resolverFactory`, `getResourceGrid` pattern | Task-app should use generated grid wherever the generic path is sufficient |
| GraphQL generation | Generated create/update/delete mutations | ✅ | ✅ | `resolverFactory` | Manual mutations should be restricted to real domain behavior |
| GraphQL generation | Prefixing operation names | ✅ | ✅ | examples use `prefix: 'SkeletonModule_'`, `TaskSystem_`, `OmniKernel_` | Task-app/OmniKernel can keep stable API naming without manual resolver code |
| GraphQL customization | Per-query/per-mutation decorators | ✅ | ✅ | `queries.getResource.decorators`, etc. in skeleton example | Guards/interceptors do not require handwritten CRUD methods |
| GraphQL customization | `extraArgs` on generated queries | ✅ | ⚠️ partial | skeleton user grid uses `firstName`, `lastName` | Task-app filters/search-style arguments may fit here instead of custom queries |
| GraphQL customization | `extraArgsStrategy` (`AT_LEAST_ONE`, `ONLY_ONE`, etc.) | ✅ | ⚠️ partial | enums/tests/docs mention it; skeleton example uses `AT_LEAST_ONE` | Useful for meaningful query contracts without handwritten validation |
| GraphQL customization | `extraInputs` on mutations | ✅ | ⚠️ partial | skeleton example uses `lowerCaseEmail` with middleware | Important for task-app write orchestration and semantic inputs |
| GraphQL customization | `extraInputs.middleware` | ✅ | ⚠️ partial | skeleton example lowercases email through middleware | Could be used to massage Omni write inputs without replacing generated mutations |
| GraphQL customization | `readonly` resolver mode | ✅ | ⚠️ partial | `generic.resolver.ts`, tests | Useful for exposing read-only Omni surfaces cleanly |
| GraphQL customization | `customQueries` | ✅ | ⚠️ partial | `generic.resolver.ts`, tests, docs | Prefer custom queries attached to factory output rather than whole manual CRUD resolvers |
| GraphQL modeling | DTO separate from entity | ✅ | ✅ | `dto` + `input` configuration in examples/docs | Important for OmniKernel where storage model and API model differ |
| GraphQL modeling | Relation metadata via `ModelField({ relation: ... })` | ✅ | ⚠️ partial | `getEntityRelations(...)`, task/skeleton DTOs | Key to restoring join-aware/generated GraphQL instead of manual relation resolvers where possible |
| GraphQL modeling | Derived/virtual fields via `mode: 'derived'` | ✅ | ⚠️ partial | tests + skeleton entity | OmniKernel should support and document this aggressively |
| GraphQL query building | Join argument application | ✅ | ⚠️ partial | `applyJoinArguments(...)`, resolver internals, tests | OmniKernel/task-app should lean on join metadata before custom relation fetch paths |
| GraphQL query building | Auto-select behavior for derived fields | ✅ | ⚠️ partial | `applySelectOnFind(...)` | Relevant for JSON/derived fields inside Omni-backed DTOs |
| GraphQL query building | Filter expression traversal | ✅ | ⚠️ partial | filter helpers/tests | Need clearer docs/examples before task-app redesign |
| REST generation | `crudRestControllerFactory` full CRUD controller | ✅ | ✅ | `docs/crud-gen-rest.md`, skeleton app | Task-app should restore this wherever REST is standard CRUD |
| REST generation | `readonly` REST surface | ✅ | ✅ | REST docs + factory | Useful for Omni read-only resources |
| REST generation | Per-mutation disable/toggle | ✅ | ✅ | REST docs | Good fit when some resources should expose partial write surface |
| REST generation | Extra decorators on REST controller/endpoints | ✅ | ✅ | REST factory options | Guards/interceptors should not force manual controllers |
| REST query handling | Pagination + sort model DTO factories | ✅ | ✅ | `crud-gen-rest.md` | Task-app should adopt standard query DTO flow instead of bespoke parsing |
| REST query handling | OData expand allowlist | ✅ | ⚠️ partial | REST factory + tests (`allowedExpands`) | Potentially useful for Omni relation exposure |
| REST query handling | Advanced filters parity with GraphQL | ⚠️ partial | ⚠️ partial | REST docs explicitly say filters are not fully implemented | This is a real limitation to account for in task-app design |
| Events / infra | Event manager integration with generated CRUD surfaces | ⚠️ indirect | ❌ under-documented | possible through service layer, but no strong canonical doc/example yet | Need docs + task-app examples |
| Events / infra | API strategy integration with CrudGen-first apps | ⚠️ indirect | ❌ under-documented | examples exist in apps/modules but not as a CrudGen composition narrative | Need docs + task-app examples |
| Omni compatibility | JSON/simple-json fields in storage | ✅ at entity level | ⚠️ partial | TypeORM entities already use simple-json in Omni | Need to verify/document CrudGen filtering/sorting behavior on JSON-backed fields |
| Omni compatibility | DB-agnostic derived/join semantics on Omni entities | ⚠️ partial | ❌ | possible but not yet demonstrated cleanly in docs/examples | This is a key OmniKernel hardening target |
| Testing/storytelling | Minimal “boring” app showing plain CrudGen | ✅ | ✅ partial | skeleton app | Keep as canonical baseline |
| Testing/storytelling | Real app composed with CrudGen + advanced substrate | ❌ not yet | ❌ | task-app currently deviates too much into manual surfaces | Main refactor target |

---

## What CrudGen already gives us that the current task-app is underusing

### 1) Generated CRUD surfaces can still be customized a lot

The framework already lets us keep generated CRUD while customizing behavior through:

- custom resolver provider
- custom service provider
- custom repository provider
- dataloader configuration
- DTO/entity decoupling
- extra args on queries
- extra inputs on mutations
- mutation middleware
- query/mutation decorators
- readonly exposure
- customQueries

This means the current task-app should not need to handwrite most CRUD GraphQL/REST endpoints.

### 2) Relation/derived field support already exists conceptually

CrudGen already understands enough metadata to support more than flat tables:

- relation metadata
- derived fields
- join application
- select handling for derived fields

This is important because OmniKernel should be treated as a **composition substrate**, not as a reason to abandon CrudGen.

### 3) The biggest current gap is not raw capability, but framework storytelling

The docs are split across several files and do not yet produce a single clean mental model for:

- when to use plain generated CRUD
- when to override services/repositories
- when to attach custom queries/mutations
- how derived fields/joins/DTO mapping should be modeled
- how API strategy + event manager fit into CrudGen-first apps

---

## Gaps / risks that still need concrete work

### A. REST advanced filtering is not at GraphQL parity

This is explicitly noted in the REST docs.

Implication:
- task-app may still need either:
  - GraphQL-first advanced filtering
  - narrow custom REST endpoints for specific cases
  - or framework extension work if full REST parity is desired

### B. OmniKernel examples are too basic today

Current Omni resolvers mostly show straightforward CrudGen usage per entity, but not yet:

- rich relation composition
- virtual/derived fields in realistic workflows
- JSON-backed field exposure patterns
- join-heavy real app composition

Implication:
- OmniKernel needs stronger example coverage before task-app can use it as the intended advanced substrate example

### C. Event manager / API strategy patterns are not yet taught as part of CrudGen composition

The framework has these systems, but the documentation does not yet explain a canonical pattern for:

- generated CRUD surface + event manager service layer
- generated CRUD surface + API-strategy-based cross-service communication

Implication:
- docs and task-app examples must fill this gap

### D. Task-app currently proves functionality more than architectural fit

The current task-app work demonstrated Omni-backed behavior, but not the desired framework shape.

Implication:
- task-app should be refactored so generated CrudGen surfaces become primary again
- custom code should move downward into service/repository/mapping layers

---

## Immediate implications for the next implementation phase

### OmniKernel

Before rebuilding task-app, OmniKernel should be evaluated/refined for:

- relation metadata friendliness
- derived field friendliness
- JSON/simple-json exposure patterns
- generated grid/query compatibility
- clear service/repository override points for CrudGen-first consumers

### Task app

Task-app should be redesigned with this order of preference:

1. generated GraphQL via `resolverFactory`
2. generated REST via `crudRestControllerFactory`
3. custom service/repository overrides for Omni behavior
4. custom queries/mutations only where generic CRUD genuinely stops being expressive enough
5. manual controllers/resolvers only as last resort

### Docs

Documentation should be expanded so future implementers can answer:

- “Can CrudGen already do this?”
- “If yes, where do I plug my custom logic?”
- “If no, is the gap in CrudGen, in OmniKernel, or only in the docs/examples?”

---

## Recommended next deliverables

1. A dedicated doc: **CrudGen-first composition guide**
   - from skeleton-app to advanced service/repository override

2. A dedicated doc: **OmniKernel as a CrudGen backend**
   - derived fields, relations, JSON fields, grid, joins, examples

3. Task-app refactor plan broken down by resource
   - projects
   - tasks
   - events
   - external refs
   - sync states

4. API strategy + event manager composition guide
   - explicit examples integrated into app architecture docs

---

## Current status of this matrix

- [x] Initial matrix drafted
- [x] Basic evidence gathered from source/docs/examples
- [ ] Add line-precise source references where useful
- [ ] Expand with repository/service factory specifics
- [ ] Expand with test-backed examples for each advanced capability
- [ ] Convert findings into final framework docs updates
