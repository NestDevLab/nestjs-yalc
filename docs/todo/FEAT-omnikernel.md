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

## Current Status

Already completed in PR `#123`:

- base shared entities
- GraphQL DTOs and resolver factory wiring
- module registration
- foundational tests
- first concrete document slice
- review-driven fixes already applied

Still open before the full OmniKernel PR is done:

- collection and organization layer
- richer relation semantics
- concrete external reference workflows
- higher-level service/query helpers
- CI integration for OmniKernel tests
- final documentation and review cleanup

## Principles

- Keep the data model generic where possible and specialize only where the
  example becomes more useful.
- Enforce important invariants at the write path, not only in DTO validation.
- Keep the example understandable as a reference implementation.
- Prefer a coherent final module over many half-explained intermediate slices.

## Workstream 1 — Foundations Hardening

- Enforce `OmniDocumentEntity.kind` at the service/write layer, not only through
  DTO shape or class defaults.
- Decide whether base `OmniRecordEntity` writes need explicit STI discriminator
  tests.
- Add integration-style tests for record/document persistence invariants.
- Integrate OmniKernel tests into the repo-level Jest/CI flow, or document
  clearly why they remain example-local.

## Workstream 2 — Organization Layer

- Add `OmniCollectionEntity`.
- Define collection fields and inheritance strategy.
- Add collection DTOs with validation decorators.
- Add collection resolver factory.
- Register collection entity/providers in `OmniKernelModule`.
- Export collection pieces from `src/index.ts`.
- Add collection entity tests.
- Add relation tests for document-to-collection graph links.
- Update README and this plan with collection examples.

## Workstream 3 — Relation Semantics

- Revisit `OmniRelationKind` for the next concrete use cases.
- Add collection-oriented kinds such as `contains`, `belongs_to`, or the final
  chosen names.
- Decide whether relation direction alone is sufficient or whether helper
  semantics are needed.
- Add tests for allowed and expected relation combinations.
- Document the intended graph semantics in the README.

## Workstream 4 — External Reference Workflows

- Decide which internal entities can be referenced externally in the example.
- Formalize `internalType` values as constants or enums if needed.
- Add example DTO/service usage for document external synchronization.
- Add validation and lookup tests for external refs.
- Document example provider/account/container usage.

## Workstream 5 — Service and Query Layer

- Add example higher-level service helpers for common OmniKernel queries.
- Add document traversal helpers through relations.
- Add collection membership query examples.
- Decide whether dedicated read/query services belong in the example.
- Add tests for non-trivial query flows.

## Workstream 6 — Documentation & Developer Experience

- Expand the OmniKernel README with architecture overview and usage examples.
- Document the difference between base records, documents, collections,
  relations, and external refs.
- Document the single-table record strategy.
- Document known tradeoffs and intentional limitations of the example.

## Workstream 7 — Final Validation & Review

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
6. Finish docs, CI coverage, and final review.

## Definition of Done

OmniKernel is ready when all of the following are true:

- the data model is coherent across records, documents, collections, relations,
  and external refs
- the example exposes a clear GraphQL CRUD surface for the intended entities
- the important invariants are enforced at the write path, not only in DTOs
- tests cover both metadata shape and the key behavioral flows
- the README explains what OmniKernel is, what problem it solves, and how the
  model fits together
- the PR reads like a complete reference module rather than a partial scaffold
