# Task App -> OmniKernel adoption checklist

Source of truth:
- `docs/todo/FEAT-task-app-omnikernel-adoption.md`

## Implementation checklist

- [x] Locate or restore the real task-app source tree
  - Source confirmed in `examples/task-system-app/apps/task-system-app/src/`
  - No implementation work performed in `dist/`

- [x] Introduce an explicit adapter module/service layer
  - Added `apps/task-system-app/src/omni-task-app/`
  - Mapping logic kept out of controllers and GraphQL resolvers

- [x] Map containers to `OmniCollectionEntity`
  - Projects persist through Omni collections
  - Human-facing fields mapped via title/slug/summary/payload

- [x] Map tasks to `OmniRecordEntity`
  - Tasks persist with `kind = 'task'`
  - Task-specific fields live in disciplined `payload`
  - No `OmniTaskEntity` introduced

- [x] Map external refs to `OmniExternalRefEntity`
  - Task refs use `internalType = record`
  - Provider/account/container/externalId preserved

- [x] Use canonical Omni relations only
  - `contains` for collection membership
  - `references` for task cross-links
  - `related_to` for loose task associations
  - No `belongs_to` introduced

- [x] Add Omni-only modeling for the remaining task-app concepts
  - Events now persist as `OmniRecordEntity(kind='event')`
  - Sync states now persist as `OmniRecordEntity(kind='sync-state')`

- [x] Wire real OmniKernel-backed REST read paths
  - `GET /tasks?projectId=...`
  - `GET /projects/:id/tasks`
  - `GET /events`
  - `GET /sync-states`
  - `GET /external-refs`

- [x] Wire real OmniKernel-backed REST write paths
  - `POST/PUT /projects`
  - `POST/PUT /tasks`
  - `POST/PUT /events`
  - `POST/PUT /sync-states`
  - `POST/PUT /external-refs`

- [x] Remove legacy task-app storage usage
  - Removed task-app dependence on legacy task-system entities/tables for runtime persistence
  - Removed dual write to legacy task tables
  - Task app now uses Omni entities/repositories only

- [x] Switch GraphQL task-app API to Omni-backed resolvers
  - Added local GraphQL-compatible `TaskSystem_*` resolvers backed by Omni services
  - Preserved the outward GraphQL contract while replacing the storage backend
  - Added Omni-backed relation resolution for `project.tasks`, `project.events`, `task.project`, `event.project`

- [x] Add tests for mapping layer
  - `task-app-omni.mapper.spec.ts`

- [x] Add tests for collection membership flow
  - `task-app-omni.integration.spec.ts`

- [x] Add tests for relation flow
  - `task-app-omni.integration.spec.ts`
  - Covers `references` and `related_to`

- [x] Add tests for GraphQL compatibility
  - `test/task-system.graphql.e2e-spec.ts`
  - create/read/update/delete paths now run on Omni-backed resolvers
  - join/sort/pagination compatibility preserved

- [x] Add docs/checklist updates for the migration
  - `examples/task-system-app/README.md`
  - `docs/todo/FEAT-task-app-omnikernel-adoption.checklist.md`

- [x] Run repo validation relevant to this switchover
  - `npm run lint` ✅
  - `npm test -- --runInBand --no-watchman` ✅
  - `npm run test:e2e -- --runInBand --no-watchman` ✅
  - `npm run build` ✅
  - Combined pipeline run ✅

## Current focus

- [x] Initial Omni adoption slice
- [x] Full GraphQL switchover
- [x] Remove dual write / legacy persistence
- [x] Full pipeline green

## Notes

- The task app now uses Omni entities as its only persistence substrate.
- GraphQL compatibility is preserved intentionally even though the backend implementation is no longer the legacy task-system module.
