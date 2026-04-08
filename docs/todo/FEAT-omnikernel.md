# OmniKernel Implementation Plan

## Goal

Build OmniKernel as one consolidated PR on top of the current foundations and
document slice, and only merge once the whole example module is coherent,
reviewed, and validated end to end.

Current active PR:

- `#123` `feat/omnikernel-foundations`

Decision:

- keep a single large PR for the full OmniKernel example
- continue extending the existing branch instead of splitting follow-up PRs
- use this file as the working checklist until the module is complete

## Current Status

Completed in the PR already:

- base shared entities
- GraphQL DTOs and resolver factory wiring
- module registration
- foundational entity tests
- first concrete document slice
- Copilot review fixes already addressed

Still open before the final OmniKernel PR is ready:

- collection and organization layer
- external reference workflows on concrete entities
- higher-level query and service patterns
- CI integration for OmniKernel tests
- final docs and review pass

## Workstreams

### 1. Foundations Hardening

Purpose:

- close remaining correctness gaps in the current base model before more
  features are layered on top

Checklist:

- [ ] Enforce `OmniDocumentEntity.kind` at the service/write layer, not only in
      DTO shape or class defaults
- [ ] Decide whether base `OmniRecordEntity` writes need explicit STI
      discriminator tests
- [ ] Add integration-style tests for record/document persistence invariants
- [ ] Integrate OmniKernel tests into the repo-level Jest/CI flow, or document
      clearly why it remains example-local

### 2. Organization Layer

Purpose:

- make documents groupable and navigable instead of only storable

Checklist:

- [ ] Add `OmniCollectionEntity`
- [ ] Define collection fields and inheritance strategy
- [ ] Add collection DTOs with validation decorators
- [ ] Add collection resolver factory
- [ ] Register collection entity/providers in `OmniKernelModule`
- [ ] Export collection pieces from `src/index.ts`
- [ ] Add collection entity tests
- [ ] Add relation tests for document-to-collection graph links
- [ ] Update README and this plan with collection examples

### 3. Relation Semantics

Purpose:

- move from generic graph edges to a usable domain language

Checklist:

- [ ] Revisit `OmniRelationKind` for the next concrete use cases
- [ ] Add collection-oriented kinds such as `contains`, `belongs_to`, or the
      final chosen names
- [ ] Decide whether relation direction is sufficient or whether helper
      semantics are needed
- [ ] Add tests for allowed and expected relation combinations
- [ ] Document the intended graph semantics in the README

### 4. External Reference Workflows

Purpose:

- make `OmniExternalRefEntity` useful for real synchronization scenarios

Checklist:

- [ ] Decide which internal entities can be referenced externally in the example
- [ ] Formalize `internalType` values as constants or enums if needed
- [ ] Add example DTO/service usage for document external synchronization
- [ ] Add validation and lookup tests for external refs
- [ ] Document example provider/account/container usage

### 5. Service and Query Layer

Purpose:

- demonstrate how OmniKernel becomes useful beyond CRUD wiring

Checklist:

- [ ] Add example higher-level service helpers for common OmniKernel queries
- [ ] Add document traversal helpers through relations
- [ ] Add collection membership query examples
- [ ] Decide whether dedicated read/query services belong in the example
- [ ] Add tests for non-trivial query flows

### 6. Documentation and Developer Experience

Purpose:

- make the module understandable and consumable as a reference example

Checklist:

- [ ] Expand README with architecture overview
- [ ] Add usage snippets for module registration and CRUD usage
- [ ] Document the difference between base records, documents, collections, and
      relations
- [ ] Document the single-table record strategy
- [ ] Document known tradeoffs and intentional limitations of the example

### 7. Final Validation and Review

Purpose:

- finish the PR in a merge-ready state

Checklist:

- [ ] Run targeted OmniKernel lint
- [ ] Run targeted OmniKernel Jest suite
- [ ] Run repo-wide `npm run ci:checks`
- [ ] Confirm any repo-wide failures are either fixed or explicitly unrelated
- [ ] Re-review the full PR diff for consistency and dead code
- [ ] Resolve remaining GitHub review threads
- [ ] Refresh the PR description with the final module scope

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
- tests cover both metadata shape and at least the key behavioral flows
- the README explains how to use the module and how the model fits together
- the PR can be reviewed as a complete example without needing follow-up PRs to
  understand the design
