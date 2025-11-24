## Goal
- Raise unit test coverage to (or as close as reasonably achievable to) 100% across packages, tightening Jest thresholds accordingly.
- Add end-to-end coverage via a small sample app that exercises `crud-gen` against SQLite, validating core CRUD behaviour.

## Principles
- Keep coverage meaningful: test observable behaviour, not implementation details.
- Prefer deterministic, hermetic tests (in-memory SQLite where possible).
- Update docs in step with behaviour and test harness changes.
- Avoid widening Jest overrides unless absolutely necessary; prefer eliminating them.

## Workstream 1 — Baseline & Gap Analysis
- Run `npm run ci:checks` once to establish the current coverage report (see `var/coverage/`).
- Catalogue packages with shortfalls vs 100% and note existing overrides (app, logger, utils).
- Identify untested critical paths: error handling, edge branches, async flows, configuration fallbacks.

## Workstream 2 — Unit Test Enhancements
- `@nestjs-yalc/app`: cover bootstrapping helpers, exception filters, pipes/guards, and module wiring edge cases.
- `@nestjs-yalc/logger`: exercise transports/config fallbacks, redaction, request-scoped behaviour, and error paths.
- `@nestjs-yalc/utils`: close gaps on date/uuid helpers, parsing/validation utilities, and branches currently skipped by overrides.
- `@nestjs-yalc/crud-gen`: cover schema parsing, resource factory configuration, guards/pipes middleware integration, validation/serialization hooks, pagination/filtering edge cases, and error surfaces; ensure generated controllers/services routes are exercised without relying on implementation details.
- `@nestjs-yalc/errors` + `event-manager` + `field-middleware`: add branch-complete tests for custom exceptions, event flow, and middleware edge cases (bad payloads, timing, idempotency).
- Remaining libraries (aws-helpers, data-loader, database, graphql, interfaces, jest helpers, types, types-extends, utils extras): backfill gaps discovered in Workstream 1, prioritising high-usage utilities and any branches currently marked `/* istanbul ignore next */`.

## Workstream 3 — Jest Threshold Tightening
- Inspect `jest.config.ts` and per-package configs; document current global/override thresholds.
- Increment thresholds toward 100% in stages (e.g., raise globals first, then remove package-specific relaxations once gaps are closed).
- Ensure `test:cov` fails on regressions; keep skipped projects list unchanged unless we add coverage for them.

## Workstream 4 — E2E Sample App (SQLite + crud-gen)
- ✅ Add SQLite-backed e2e on `examples/skeleton-app` using the shared `skeleton-module` entities/services (`SkeletonUser`, `SkeletonPhone`) with REST + GraphQL CRUD (create/list/get/update/delete) via supertest.
- ✅ Provide a single `npm run test:e2e` (root) wired into `ci:checks` that runs both REST + GraphQL suites in the skeleton app.
- TODO: Broaden scenarios (filters/pagination edge cases, joins) and add a short README in `examples/skeleton-app` explaining the SQLite e2e flow and module wiring.
- TODO: Finalise GraphQL e2e bootstrap (ts-jest + Nest GraphQL plugin is still failing; consider running e2e against the built artifacts to avoid transformer issues, or provide a stable transformer wrapper).

## Workstream 5 — Documentation & Developer Experience
- Update `docs/README.md` and relevant CRUD docs to reference the new SQLite example, setup steps, and test commands.
- Add README inside the example describing schema, env vars, and how to run the e2e suite.
- Document any new scripts or config changes (coverage thresholds, jest settings).

## Workstream 6 — Stabilisation & Exit Criteria
- Verify `npm run ci:checks` passes with tightened thresholds and new tests.
- Confirm coverage reports show near-100% across targeted packages and that overrides are minimized.
- Ensure no artefacts (`var/`, `node_modules`) are tracked; keep repo clean.
- Open questions to resolve during implementation: chosen location for e2e app, whether to include e2e coverage in global thresholds, and acceptable runtime for `ci:checks`.
- Current gaps: root unit suite passes, but skeleton-app `npm run test:e2e` is still red due to GraphQL schema/transformer configuration; fix pending next session.
