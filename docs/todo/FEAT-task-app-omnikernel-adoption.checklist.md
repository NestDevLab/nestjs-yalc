# Task App -> OmniKernel adoption checklist

Source of truth:
- `docs/todo/FEAT-task-app-omnikernel-adoption.md`

## Implementation checklist

- [x] Locate or restore the real task-app source tree
  - Source confirmed in `examples/task-system-app/apps/task-system-app/src/`
  - No implementation work performed in `dist/`

- [x] Introduce an explicit adapter module/service layer
  - Added `apps/task-system-app/src/omni-task-app/`
  - Mapping logic kept out of controllers

- [x] Map containers to `OmniCollectionEntity`
  - Projects persist through Omni collections
  - Human-facing fields mapped via title/slug/summary

- [x] Map tasks to `OmniRecordEntity`
  - Tasks persist with `kind = 'task'`
  - Task-specific fields stay in disciplined `payload`
  - No `OmniTaskEntity` introduced

- [x] Map external refs to `OmniExternalRefEntity`
  - Task refs use `internalType = record`
  - Provider/account/container/externalId preserved
  - Omni external-ref helper workflows are used for internal-record lookup / upsert paths where applicable

- [x] Use canonical Omni relations only
  - `contains` for collection -> task membership
  - `references` for task cross-links
  - `related_to` for loose associations
  - No `belongs_to` introduced

- [x] Wire at least one real OmniKernel-backed read path
  - `GET /tasks?projectId=...`
  - `GET /projects/:id/tasks`

- [x] Wire at least one real OmniKernel-backed write path
  - `POST/PUT /projects`
  - `POST/PUT /tasks`
  - `POST/PUT /external-refs`

- [x] Keep the migration incremental and reversible
  - REST slice writes through Omni adapter layer
  - Legacy task tables still mirrored for compatibility with unchanged slices

- [x] Add tests for mapping layer
  - `task-app-omni.mapper.spec.ts`

- [x] Add tests for collection membership flow
  - `task-app-omni.integration.spec.ts`

- [x] Add tests for relation flow
  - `task-app-omni.integration.spec.ts`
  - Covers `references` and `related_to`

- [x] Add tests for external-ref sync flow
  - `task-app-omni.integration.spec.ts`

- [x] Add docs for the adoption slice
  - `examples/task-system-app/README.md`

- [x] Run repo validation relevant to this slice
  - `npm test -- --runInBand --no-watchman` ✅
  - `npm run test:e2e -- --runInBand --no-watchman` ✅
  - Re-run after refinement: still green ✅

- [x] Full example-app build validation green
  - Fixed OmniKernel example source compatibility issues required by the task-app adoption slice
  - `npm run build` ✅
  - `npm run lint && npm test -- --runInBand --no-watchman && npm run test:e2e -- --runInBand --no-watchman && npm run build` ✅

## Current focus

- [x] Establish initial adoption slice
- [x] Ensure mappings follow the markdown rules exactly
- [x] Final PR polish / commit shaping / PR body prep ready

## Notes

- This checklist is meant to stay updated during the implementation work.
- If scope starts expanding beyond the markdown plan, split the follow-up instead of broadening this PR.
