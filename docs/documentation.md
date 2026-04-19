---
title: Documentation
description: Full NestJS-YALC wiki index, examples, and repository reference.
permalink: /documentation
---

# Documentation

NestJS-YALC stands for NestJS - Yet Another Library Collection. Use this index
as the entrypoint for the full wiki, examples, and repository reference.

## Start here

- [Getting started](./getting-started.md): install the workspace, run the skeleton app, and inspect the copyable resource definition.
- [Backend blueprint](./backend-blueprint.md): the opinionated playbook for new NestJS-YALC backends.
- [CrudGen-first composition](./crudgen-first-composition.md): how to keep generated CRUD surfaces while customizing the right layer.
- [Modular platform guide](./how-to-integrate-nestjs-yalc.md): how to build a modular platform with NestJS-YALC.

## What the framework gives you

- CrudGen filters for GraphQL endpoints.
- Runtime generation of CRUD endpoints through NestJS dependency factories.
- Parameterized generation of resolvers, services, dataloaders, and TypeORM repositories from entities and DTOs.
- JSON support for TypeORM entities through decorators.
- MySQL view-read/table-write patterns through the same repository boundary.
- GraphQL extensions for field middleware, TypeORM field mapping, nested field resolving, dataloaders, and joins.
- Jest helpers for monorepo testing.
- Utility classes and helpers for common NestJS platform work.

## Architecture guides

- [Backend blueprint: the opinionated way to use NestJS-YALC for new backends](./backend-blueprint.md)
- [How to build a modular platform with NestJS-YALC](./how-to-integrate-nestjs-yalc.md)
- [CrudGen-first composition guide](./crudgen-first-composition.md)
- [OmniKernel as a CrudGen backend](./omnikernel-crudgen-backend.md)
- [Task-system app composition guide](./task-system-app-composition.md)
- [Task-system app plan](./task-system-app-plan.md)
- [Unified naming guideline for parallel GraphQL and REST APIs](./api-naming-conventions.md)

## CrudGen

- [How to create GraphQL APIs with NestJS-YALC CrudGen](./api-creation.md)
- [CRUD-Gen modeling with ModelObject and ModelField](./crud-gen-modeling.md)
- [CRUD-Gen dependency factory reference](./crud-gen-factory.md)
- [CRUD-Gen REST usage](./crud-gen-rest.md)
- [OData-like query facade for REST](./odata-like-query-facade.md)

## Runtime libraries

- [API Strategy](./api-strategy.md)
- [API Strategy and EventManager integration patterns](./api-strategy-event-manager-patterns.md)
- [EventManager module](./event-manager-module.md)
- [EventManager event helper](./event-manager-event.md)
- [YalcEventService](./event-manager-service.md)
- [Error handling with EventManager and DefaultError](./error-handling.md)
- [DefaultError library](./errors.md)
- [Logger library](./logger.md)
- [Observability and OpenTelemetry integration](./observability.md)

## Examples

- [Examples overview](https://github.com/NestDevLab/nestjs-yalc/tree/dev/examples)
- [Skeleton app](https://github.com/NestDevLab/nestjs-yalc/tree/dev/examples/skeleton/app): the minimal all-in-one `CrudGenResourceFactory` path with a small module API-client example.
- [OmniKernel app](https://github.com/NestDevLab/nestjs-yalc/tree/dev/examples/omnikernel/app): generated REST and GraphQL over a backend-only OmniKernel substrate.
- [Task app](https://github.com/NestDevLab/nestjs-yalc/tree/dev/examples/task/app): the advanced OmniKernel-backed composition with module API-client workflows and CI/e2e validation.

## Publication and maintenance

- [Public NPM publication](./npm-publication.md)
- [Public example mirrors](./public-example-mirrors.md)
- [Framework hardening follow-ups](./framework-hardening-followups.md)

## Planning notes

- [CrudGen capability matrix](./todo/FEAT-crudgen-capability-matrix.md)
- [CrudGen-first OmniKernel task app plan](./todo/FEAT-crudgen-first-omnikernel-task-app-plan.md)
- [CrudGen infrastructure patterns](./todo/FEAT-crudgen-infra-patterns.md)
- [Improve test coverage](./todo/FEAT-improve-test-coverage.md)
- [OmniKernel](./todo/FEAT-omnikernel.md)
- [OmniKernel CrudGen gap analysis](./todo/FEAT-omnikernel-crudgen-gap-analysis.md)
- [Task app CrudGen refactor map](./todo/FEAT-task-app-crudgen-refactor-map.md)
- [Task app OmniKernel adoption plan](./todo/FEAT-task-app-omnikernel-adoption.md)
- [Task app OmniKernel adoption checklist](./todo/FEAT-task-app-omnikernel-adoption.checklist.md)

## NPM workspace

The root `package.json` manages scripts and dependencies for the whole library
collection. It contains the `devDependencies` needed for tests and builds, and
the dependencies used by the packages themselves.

Prefer the npm workspace approach. It lets each package declare its own scripts
and dependencies while still allowing root-level orchestration.

## Unit tests

The root `package.json` contains scripts for running unit tests across the
library collection. The repository uses Jest `projects`, configured by
`jest.config.ts`, with helpers from `@nestjs-yalc/jest`.

When Jest errors with messages like "Cannot assign to read only property ..."
while mocking ESM modules, load the module through `importMockedEsm` from
`@nestjs-yalc/jest/esm.helper` before importing the system under test.
`importMockedEsm` wraps functions with `jest.fn` and registers them using
`jest.unstable_mockModule`, which avoids read-only export issues. Use
`mockNestJSGraphql(import.meta)` for `@nestjs/graphql` convenience.

Run coverage with:

```bash
npm run test:cov
```

Then serve coverage with:

```bash
npm run test:cov:serve
```

The coverage report is available at:

```text
http://127.0.0.1:8080/lcov-report/
```

## Pipeline

The GitHub pipeline checks linting, builds, and tests with the configured
coverage thresholds.

## Directory conventions

The `nestjs-yalc` directory structure is intentionally flat so the packages can
be integrated into other projects easily.

- `tsconfig.json`: compiler and IDE configuration.
- `tsconfig.test.json`: Jest configuration.
- `tsconfig.dev.json`: development tooling configuration.
- `test.js`: test helper entrypoint.
- `examples/`: runnable example applications and modules.
- `docs/`: GitHub Pages documentation.
- `[package]/`: one top-level directory per workspace package.

## Repo-specific utilities

- `var/asl-test.cjs`: manual AsyncLocalStorage sanity check for Fastify and ALS. It is not used by builds or tests.
- `build-dist.mjs`: local pack script that writes `dist/package.json` for each package with exports pointing at compiled output. Source `package.json` files stay untouched; the dist files are generated after `npm run build`.
