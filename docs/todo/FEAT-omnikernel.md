# OmniKernel Plan

## What OmniKernel Is

OmniKernel is the example module meant to show how `nestjs-yalc` can support a
generic content and knowledge kernel.

Its purpose is to model a small but coherent graph of:

- generic records,
- concrete document-like records,
- future collections or containers,
- typed relations between entities,
- and external references to third-party systems.

This is not meant to be an AI-specific module and not a full product app.
The target is a reusable reference example for systems that need structured
content, graph navigation, and sync-friendly identifiers.

## Final Objective

The final OmniKernel example should make it obvious how to build a module that:

- stores generic records with a shared base model,
- specializes some records into documents,
- groups documents into collections,
- links entities through typed graph edges,
- tracks mappings to external providers,
- and exposes both CRUD and higher-level query/traversal patterns.

The end state should be reviewable as one coherent module, not as a pile of
unrelated entities.

## Planned Downstream Adoption

OmniKernel is also meant to become the substrate for the task application once
the model is stable enough.

The intended mapping is:

- tasks and similar domain items -> Omni records or document-like records
- projects, boards, or higher-level groupings -> Omni collections
- dependencies, hierarchy, and cross-links -> Omni relations
- external trackers or provider sync state -> Omni external refs

This adoption should happen after the OmniKernel model is coherent, not before,
so the task application does not need to be rewritten on every intermediate
schema change.

## Current Status

Already completed in PR `#123`:

- base shared entities
- GraphQL DTOs and resolver factory wiring
- module registration
- foundational tests
- first concrete document slice
- first organization and collection slice
- first explicit relation semantics slice
- typed external-ref workflow slice
- higher-level query helper slice
- review-driven fixes already applied

Still open before the full OmniKernel PR is done:

- task-application adoption once the kernel is stable
- repo-level CI integration for OmniKernel tests
- final documentation and review cleanup

## Task Completion Checklist

Use this checklist every time a concrete OmniKernel task is completed:

- [ ] Update this plan file to reflect the new status or checked item.
- [ ] Confirm the change still matches the OmniKernel final objective.
- [ ] Confirm whether the change moves OmniKernel closer to task-application
      adoption or changes that future mapping.
- [ ] Add or update tests for the behavior introduced or changed.
- [ ] Update README or docs if the behavior, model, or workflow became clearer
      or changed.
- [ ] Run the targeted OmniKernel validation needed for that task.
- [ ] Decide whether the task also needs repo-wide validation.
- [ ] Commit and push the change to the active OmniKernel PR branch.
- [ ] Reply to or resolve any review comments affected by the change.

## Principles

- Keep the data model generic where possible and specialize only where the
  example becomes more useful.
- Enforce important invariants at the write path, not only in DTO validation.
- Keep the example understandable as a reference implementation.
- Prefer a coherent final module over many half-explained intermediate slices.

## Workstream 1 — Foundations Hardening

- [x] Enforce `OmniDocumentEntity.kind` at the service/write layer, not only through
  DTO shape or class defaults.
- [x] Decide whether base `OmniRecordEntity` writes need explicit STI discriminator
  tests.
- [x] Add integration-style tests for record/document persistence invariants.
- [x] Integrate OmniKernel tests into the repo-level Jest/CI flow with root
  Jest project discovery and package-level TS config files.

## Workstream 2 — Organization Layer

- [x] Add `OmniCollectionEntity`.
- [x] Define collection fields and inheritance strategy.
- [x] Add collection DTOs with validation decorators.
- [x] Add collection resolver factory.
- [x] Register collection entity/providers in `OmniKernelModule`.
- [x] Export collection pieces from `src/index.ts`.
- [x] Add collection entity tests.
- [x] Add relation tests for document-to-collection graph links.
- [x] Update README and this plan with collection examples.

## Workstream 3 — Relation Semantics

- [x] Revisit `OmniRelationKind` for the next concrete use cases.
- [x] Keep `contains` as the canonical collection organization edge and avoid a
  redundant `belongs_to` inverse for now.
- [x] Decide that relation direction is sufficient for the inverse meaning at
  this stage and export helper semantics for the canonical edges.
- [x] Add tests for allowed and expected relation combinations.
- [x] Document the intended graph semantics in the README.

## Workstream 4 — External Reference Workflows

- [x] Decide which internal entities can be referenced externally in the example.
- [x] Formalize `internalType` values through `OmniExternalRefInternalType`.
- [x] Add example service usage for document and collection external synchronization.
- [x] Add validation and lookup tests for external refs.
- [x] Document example provider/account/container usage.

## Workstream 5 — Service and Query Layer

- [x] Add example higher-level service helpers for common OmniKernel queries.
- [x] Add document traversal helpers through relations.
- [x] Add collection membership query examples.
- [x] Decide that dedicated read/query services do belong in the example and expose `OmniKernelQueryService`.
- [x] Add tests for non-trivial query flows.

## Workstream 6 — Task Application Adoption

- Define the first task-application concepts that should map onto OmniKernel.
- Decide which task entities should be modeled as records versus documents.
- Map project or board-like structures onto collections.
- Map dependencies and hierarchy onto relation kinds.
- Map external tracker synchronization onto external refs.
- Add documentation showing the intended migration path from task-specific model
  to OmniKernel-backed model.

## Workstream 7 — Documentation & Developer Experience

- Expand the OmniKernel README with architecture overview and usage examples.
- Document the difference between base records, documents, collections,
  relations, and external refs.
- Document the single-table record strategy.
- Document known tradeoffs and intentional limitations of the example.

## Workstream 8 — Final Validation & Review

- Run targeted OmniKernel lint.
- Run targeted OmniKernel Jest suite.
- Run repo-wide `npm run ci:checks`.
- Confirm any repo-wide failures are either fixed or explicitly unrelated.
- Re-review the full PR diff for consistency and dead code.
- Resolve remaining GitHub review threads.
- Refresh the PR description with the final module scope.

## Suggested Execution Order

1. Finish foundations hardening.
2. Add collections.
3. Finalize relation semantics for documents and collections.
4. Expand external references for concrete workflows.
5. Add higher-level service/query helpers.
6. Define the task-application adoption path.
7. Finish docs, CI coverage, and final review.

## Definition of Done

OmniKernel is ready when all of the following are true:

- the data model is coherent across records, documents, collections, relations,
  and external refs
- the example exposes a clear GraphQL CRUD surface for the intended entities
- the important invariants are enforced at the write path, not only in DTOs
- tests cover both metadata shape and the key behavioral flows
- the README explains what OmniKernel is, what problem it solves, and how the
  model fits together
- the task application adoption path is clear, even if the full migration is
  implemented later
- the PR reads like a complete reference module rather than a partial scaffold
