# NestJS YALC — AI Agent Guide

- Scope: this file applies when working in `nestjs-yalc`. Run commands from that directory.
- Runtime: Node 20, ESM (`type: module`, `moduleResolution: NodeNext`, TypeScript strict). Install with `npm ci` (workspaces enabled).
- Workspaces/packages: app, crud-gen, aws-helpers, data-loader, database, errors, event-manager, field-middleware, graphql, interfaces, jest, logger, types, types-extends, utils; examples in `examples/` (skeleton-app, skeleton-module).
- When you need package details, read `docs/README.md` and package READMEs (e.g., `crud-gen/README.md`) before changing code.
- Documentation discipline: whenever you add or change meaningful behavior, update existing docs or create new ones that reflect the change (usage, rationale, examples) before handing off.
- Language: write everything in English (code, comments, docs, commit messages, etc.); use non-English only for domain-specific names that cannot be translated.

## Error handling and logging

- Prefer using `YalcEventService` from `@nestjs-yalc/event-manager` (and the underlying `@nestjs-yalc/errors` library) for application-level errors instead of throwing raw Nest `HttpException` instances or using `console` directly.
- When you need to log and return an HTTP-aware error, use the HTTP helpers on `YalcEventService` (for example `errorBadRequest`, `errorNotFound`, or `errorHttp`) so that:
  - logging level is derived from the HTTP status code,
  - a structured event payload is emitted,
  - and the thrown error carries the correct status code and a safe response body for the client.
- Keep internal diagnostics in `data`/`internalMessage` and client-facing messages in the `response` field to avoid leaking sensitive information.
- Before changing error-handling behavior, read `docs/error-handling.md`, `docs/errors.md`, and `docs/event-manager-service.md` to align with the existing patterns.

## Required commands before handing off
- Full check: `npm run ci:checks` (runs lint + build + `test:cov` with coverage thresholds).
- During iteration you may run individually: `npm run lint:no-fix`, `npm run build`, `npm run test:cov`. Use `JEST_WORKERS` to cap workers; coverage reports land in `var/coverage/` (`test:cov:serve` serves them).
- Jest defaults to 100% coverage (branches/functions/lines/statements) with overrides for `@nestjs-yalc/app`, `@nestjs-yalc/logger`, and `@nestjs-yalc/utils`; skipped projects by default: types, graphql, crud-gen, kafka, jest. `injectGlobals` is false.

## Lint/format/build
- ESLint + Prettier (single quotes, trailing commas). `no-console` is an error, `eqeqeq` enabled, `no-floating-promises` warns. Ignores `**/*spec.ts`, `__tests__`, `__mocks__`, `var`, `jest.config.ts`.
- TypeScript build emits declarations to `var/dist`; strict mode on, paths from `tsconfig.json`.

## Repo hygiene
- Do not commit `var/` outputs (coverage, dist) or `node_modules/`. `.editorconfig`: LF, 2 spaces for TS/JS/JSON, final newline.
- Keep generated artefacts out of git; only source/metadata should be committed.

## CI/CD
- GitHub Actions `libs.yml` runs lint/build/test on dev/master/PR (Node 20, `npm ci --prefer-offline --no-audit`). PR labels `pr-version-patch/minor` trigger the auto version-bump workflow.

## Docs and references
- Overview: `docs/README.md`
- GraphQL CRUD guide: `docs/api-creation.md`
- Modeling (ModelObject/ModelField): `docs/crud-gen-modeling.md`
- Dependency factory options: `docs/crud-gen-factory.md`
- REST usage: `docs/crud-gen-rest.md`
