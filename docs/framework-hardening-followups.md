# Framework hardening follow-ups after PR #121

This document tracks the main non-blocking follow-ups that remain after the task-system scaffold and CRUD-Gen hardening work merged into PR #121.

## Why this file exists

PR #121 closes real bugs and improves the framework in meaningful ways:

- explicit CRUD-Gen repository capabilities
- stronger generated GraphQL input typing for field ids
- stable enum registration for GraphQL generated inputs
- cleaner example/test alignment

However, a few follow-ups remain that are worth tracking explicitly instead of pretending the framework is now "done".

---

## Follow-up 1 — simplify legacy repository capability fallback

### Current state

`crud-gen` now prefers an explicit capability contract via repository capabilities, but still supports legacy fallback detection for compatibility.

### Why this still matters

The new design is already much better than method-name detection alone, but the compatibility path means the final contract is not yet as minimal and explicit as it could be.

### Target outcome

- reduce or remove primary reliance on legacy heuristics
- make the capability contract the canonical path
- document the repository capability expectations clearly
- keep backward compatibility only where genuinely needed

### Priority

Medium

---

## Follow-up 2 — clean up deprecated/permissive GraphQL input paths

### Current state

The generated entity-specific GraphQL input types were hardened again and now use stronger field typing.

The remaining weaker area is the legacy/deprecated generic input path, where permissive typing still exists for compatibility.

### Why this still matters

The important generated path is now much stronger, but the framework still exposes some older permissive paths that are easier to misuse.

### Target outcome

- document which input paths are canonical vs deprecated
- reduce ambiguity for users of the older generic types
- decide whether some deprecated permissive paths should remain, warn, or be retired

### Priority

Medium

---

## Follow-up 3 — normalize invalid-path GraphQL error expectations in examples

### Current state

Some example tests accept either:

- HTTP `400` from GraphQL validation/coercion
- or HTTP `200` with `errors[]` in the payload

This is currently honest, because invalid requests can fail at different layers depending on the path.

### Why this still matters

The current tests are truthful, but not aesthetically ideal. We may still want a more normalized stance for invalid-path behavior in examples and docs.

### Target outcome

- decide whether example expectations should keep allowing both forms
- or normalize error behavior more explicitly where feasible
- document the distinction between GraphQL validation errors and resolver/runtime errors

### Priority

Low

---

## Hardening tracks that should continue after PR #121

These are not regressions introduced by the PR, but they are the next natural framework-hardening areas.

### EventManager hardening

Focus:

- provider/export contracts
- failure path consistency
- error/event/status mapping clarity
- test coverage for error orchestration behavior

### ApiStrategy hardening

Focus:

- call strategy contracts
- failure/retry semantics
- DI/runtime behavior
- provider boundary clarity
- tests for real failure modes

---

## Recommended order

1. EventManager hardening
2. ApiStrategy hardening
3. legacy capability cleanup
4. deprecated GraphQL input path cleanup
5. optional invalid-path error normalization cleanup

---

## Merge guidance

These follow-ups are intentionally tracked **after** PR #121 because they are:

- real improvements
- not hidden blockers for the merged work
- better handled as focused hardening tasks than as scope creep inside the scaffold PR
