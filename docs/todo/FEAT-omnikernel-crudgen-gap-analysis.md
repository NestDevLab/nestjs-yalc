# FEAT — OmniKernel as a CrudGen backend: gap analysis

Status: draft / in progress  
Related plan: `docs/todo/FEAT-crudgen-first-omnikernel-task-app-plan.md`  
Related matrix: `docs/todo/FEAT-crudgen-capability-matrix.md`

## Purpose

This document answers a narrower question than the global CrudGen audit:

> What is OmniKernel already doing well as a CrudGen composition backend, and what is still missing before task-app can be rebuilt in a truly CrudGen-first way?

The goal is to improve OmniKernel first, then let task-app consume it through standard CrudGen composition patterns.

---

## Current OmniKernel posture

OmniKernel already uses CrudGen in a meaningful way.

Evidence:
- `OmniKernelModule.register(dbConnection)` composes entity registration + CrudGen-generated providers per resource
- resolvers like:
  - `omni-record.resolver.ts`
  - `omni-collection.resolver.ts`
  - `omni-relation.resolver.ts`
  are already created through `CrudGenDependencyFactory`
- DTOs already use `ModelObject` / `ModelField`
- relation metadata is already present on several DTOs
- some domain-specific service overrides already exist:
  - `OmniCollectionService`
  - `OmniDocumentService`
  - `OmniExternalRefService`

So OmniKernel is **not** starting from zero. It is already a CrudGen-based module.

However, it is still mostly an **entity-per-entity CRUD example**, not yet a fully documented/optimized reusable backend for a richer composed app like task-app.

---

## What OmniKernel already does well

## 1) CrudGen-native registration model

`OmniKernelModule.register(...)` already follows the intended registration pattern:

- entities registered through `TypeOrmModule.forFeature(...)`
- per-resource provider packs created with `CrudGenDependencyFactory`
- providers exported for downstream composition

This is good and should remain the architectural baseline.

## 2) DTO/entity separation with metadata

Omni DTOs already expose a strong pattern:

- DTO classes separate from base entities
- `ModelObject` used explicitly
- `ModelField` used for:
  - GraphQL type configuration
  - relation metadata
  - JSON/object exposure

This is a strong foundation for showing how advanced backends stay CrudGen-compatible.

## 3) Relation metadata exists already

Examples already present:
- `OmniRecordType.outgoingRelations`
- `OmniRecordType.incomingRelations`
- `OmniRelationType.sourceRecord`
- `OmniRelationType.targetRecord`
- same pattern in collections/documents

This means OmniKernel already encodes graph semantics in a way CrudGen can understand. That is exactly the right direction.

## 4) Service override pattern already exists

Examples:
- `OmniCollectionService` forces `kind = Collection`
- `OmniDocumentService` forces `kind = Document`
- `OmniExternalRefService` exposes upsert and semantic sync helpers

This is important because it proves the intended layering:
- generated CRUD surface on top
- custom semantics inside services

That is the same pattern task-app should follow later.

## 5) JSON/simple-json fields are already present in the model

Fields like `payload` are already exposed through GraphQL object types using `GraphQLJSONObject`.

This is a good baseline for the “OmniKernel supports richer field types” story.

---

## Current gaps

## Gap A — OmniKernel is still mostly resource-by-resource CRUD, not a documented advanced substrate

Today OmniKernel demonstrates:
- records
- collections
- documents
- relations
- external refs

But it does **not yet clearly demonstrate**:
- how these pieces are intended to compose into a larger app
- how to model a real domain on top of them while staying CrudGen-first
- when to use generic queries vs semantic helper services

Implication:
- task-app is currently forced to rediscover the composition story instead of consuming a well-articulated backend pattern.

## Gap B — relation metadata is present, but higher-level relation composition is still under-taught

CrudGen can understand relation metadata, but OmniKernel docs/examples do not yet clearly show:
- how to model collection members as a generated relation-friendly surface
- how to model semantic edges (`contains`, `references`, `related_to`) in a reusable way
- when relation traversal should be done via CrudGen joins vs semantic query services

Implication:
- task-app drifted into manual relation-oriented surface code too quickly.

## Gap C — no strong example yet for derived/virtual fields in Omni context

CrudGen supports derived fields conceptually, but OmniKernel does not yet present a convincing “Omni + derived fields” example.

Missing demonstrations include:
- symbolic/derived fields over payload-backed data
- derived labels or semantic projections
- behavior of derived fields in grid/select/filter/sort scenarios

Implication:
- one of the most important “advanced substrate” stories is still implicit instead of explicit.

## Gap D — JSON-backed semantics are exposed, but not yet modeled as first-class queryable patterns

`payload` is present and exposed, but the framework/docs do not yet clearly define:
- what is supported generically for JSON-backed fields
- what requires repository specialization
- what should be projected into explicit DTO fields
- what should remain opaque payload only

Implication:
- task-app currently uses payload pragmatically, but not yet with a clearly documented framework policy.

## Gap E — semantic helper services exist, but are not yet clearly integrated into CrudGen-first story

`OmniExternalRefService` and `OmniKernelQueryService` are valuable, but they currently feel more like side utilities than a documented backend API surface.

Open questions that need clearer answers:
- when should apps call these helpers directly?
- when should generated CrudGen queries be sufficient?
- when should these helpers be wrapped by app-level service overrides?

Implication:
- without that guidance, app authors are more likely to bypass CrudGen instead of composing on top of it.

## Gap F — no canonical task-app-shaped example inside OmniKernel itself

OmniKernel currently proves that generic resources can be exposed.

It does not yet prove, in a reusable documented way, patterns such as:
- “project-like collection containing task-like records”
- “relation-driven membership query”
- “semantic external-ref identity/upsert”
- “sync state or event records modeled as specialized record kinds”

Implication:
- task-app had to invent its own Omni semantics too early.

## Gap G — API strategy + event-manager story is absent at OmniKernel layer

OmniKernel does not yet teach how a CrudGen-first backend should be combined with:
- API strategy clients
- event manager logs/errors/events

Implication:
- task-app examples risk putting that knowledge only at app level instead of as a reusable framework composition pattern.

---

## Design guidance emerging from these gaps

## 1) OmniKernel should stay CrudGen-native, not become a manual API layer

The right move is **not** to add more handwritten resolvers/controllers inside OmniKernel.

The right move is to:
- keep generated CrudGen surfaces as primary
- enrich service/repository/DTO metadata layers
- add narrowly-scoped semantic helpers where generic CRUD stops

## 2) OmniKernel should define reusable semantics, not app-specific hacks

What belongs here:
- canonical modeling patterns for collections / records / relations / refs / docs
- service helpers with reusable semantics
- repository/query helpers for relation-aware traversal
- docs that explain how downstream apps should compose those pieces

What should not belong here:
- task-app-specific bespoke CRUD surface
- app-specific controller/resolver duplication

## 3) Task-app should consume OmniKernel as a substrate, not compensate for its missing examples

If task-app needs a behavior repeatedly, first ask:
- should OmniKernel expose this more canonically?
- should CrudGen metadata/service/repository support be improved here?

Only after that should task-app add local custom code.

---

## Recommended OmniKernel work items before task-app refactor

### A. Documentation work
- [ ] Write a proper “OmniKernel as CrudGen backend” guide
- [ ] Document relation modeling patterns (`contains`, `references`, `related_to`)
- [ ] Document JSON/payload usage policy
- [ ] Document when to use semantic helper services vs generic queries

### B. Example/modeling work
- [ ] Add at least one convincing derived-field example in OmniKernel
- [ ] Add at least one richer relation-composition example beyond plain outgoing/incoming relations
- [ ] Show a collection-member/resource pattern that looks closer to a real app

### C. Query/repository work
- [ ] Review whether generic repository behavior is enough for membership/grid patterns
- [ ] Identify which relation-aware queries belong in extended repositories vs helper services
- [ ] Avoid pushing app-specific pagination/filter logic into task-app if it can be generalized here

### D. Service-layer work
- [ ] Clarify and possibly expand semantic helpers for external refs / collection membership / relation traversal
- [ ] Ensure service override patterns remain the primary place for semantic write behavior

### E. Infra pattern work
- [ ] Add docs or examples showing how event-manager and API strategy should sit around Omni-backed CrudGen services

---

## Concrete implications for task-app

Once OmniKernel is better articulated, task-app should ideally become:

- generated CrudGen GraphQL CRUD/grid for standard resources
- generated CrudGen REST CRUD where applicable
- Omni-backed service overrides for:
  - project/container semantics
  - task kind semantics
  - event/sync-state kind semantics
  - external-ref semantic upsert behavior
  - relation-specific domain behavior
- minimal custom queries/mutations only for real semantic operations that exceed generic CRUD

That is the actual target architecture.

---

## Current status of this document

- [x] Initial OmniKernel gap analysis drafted
- [ ] Add line-precise source references where helpful
- [ ] Turn the guidance into concrete OmniKernel implementation tasks
- [ ] Link the results into framework docs, not only todo docs
