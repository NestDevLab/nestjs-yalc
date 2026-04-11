# Nestjs-yalc library

Nest-yalc stands for Nestjs - Yet Another Library Collection

## Features

- Support of the [CrudGen](https://www.crud-gen.com/) filters for the GraphQL endpoints
- Automatic runtime generation of CRUD endpoints using the NestJS dependency factory method
- Parametrized the generation of: Resolver, Service, Dataloader, TypeORM repository based on ORM entities and DTOs.
- Implemented JSON support for TypeORM entities by using decorators
- Possibility to handle MySQL views (read) and their relative table (write) via the same repository
- Custom decorators to extend the NestJS GraphQL library with features such as: field middleware, graphql-typeorm field mapping, nested field resolver with dataloader or join etc.
- Helper methods for jest to be integrated in a monorepo solution
- Utils classes and methods

## Documentation

- [How to create graphql API with nestjs-yalc/crud-gen](./api-creation.md)
- [CRUD-Gen modeling (ModelObject/ModelField)](./crud-gen-modeling.md)
- [CRUD-Gen dependency factory reference](./crud-gen-factory.md)
- [CRUD-Gen REST usage](./crud-gen-rest.md)
- [CrudGen-first composition guide](./crudgen-first-composition.md)
- [OmniKernel as a CrudGen backend](./omnikernel-crudgen-backend.md)
- [Task-system app composition guide](./task-system-app-composition.md)
- [API Strategy + EventManager integration patterns](./api-strategy-event-manager-patterns.md)

- [Examples overview](../examples/README.md) — the architectural map for the skeleton, OmniKernel, and task examples.
- [Skeleton App](../examples/skeleton/app/README.md) — the minimal all-in-one `CrudGenResourceFactory` path.
- [OmniKernel App](../examples/omnikernel/app/README.md) — generated REST and GraphQL over a backend-only OmniKernel substrate.
- [Task App](../examples/task/app/README.md) — the advanced OmniKernel-backed composition and CI/e2e validation target.

- [How to use the Api-Strategy library](./api-strategy.md)

- [How to use the DefaultError library](./errors.md)

- [How to orchestrate errors, logging and HTTP status codes with EventManager and DefaultError](./error-handling.md)

- [How to use the EventManager module library](./event-manager-module.md), [Event](./event-manager-event.md), [Service](./event-manager-service.md)

- [How to use the Logger library](./logger.md)
- [How to build a modular platform with nestjs-yalc](./how-to-integrate-nestjs-yalc.md)
- [Backend blueprint: the opinionated way to use nestjs-yalc for new backends](./backend-blueprint.md)
- [Framework hardening follow-ups after PR #121](./framework-hardening-followups.md)

## NPM package.json and Workspace

To handle scripts and dependencies between all the libraries of this collection we use a root `package.json`.
At the moment it handles both the `devDependencies` needed to run the tests and the build process, as well as the
dependencies of the libraries itself.

The [npm workspace](https://docs.npmjs.com/cli/v7/using-npm/workspaces) approach must be preferred by the way. It allows us to
specify the dependencies and some scripts directly inside the package itself but still having the possibility of managing them
from the root `package.json`. (see aws-sdk library for example)

## Unit tests

The main `package.json` contain some scripts to run the unit test for all the libraries of this collection.
It uses the jest `projects` feature in background configured by `jest.config.ts` by using a customized mechanism
implemented in our `@nest-yalc/jest` library.

**ESM mocking note:** when Jest errors with messages like “Cannot assign to read only property …” while mocking ESM modules (common with GraphQL decorators or helpers), load the module via `importMockedEsm` from `@nestjs-yalc/jest/esm.helper` before importing the SUT. `importMockedEsm` wraps functions with `jest.fn` and registers them using `jest.unstable_mockModule`, which avoids read-only export issues. Use `mockNestJSGraphql(import.meta)` for `@nestjs/graphql` convenience.

To run the tests with the coverage use `npm run test:cov` and then you can check the status of the tests by running `npm run test:cov:serve`
Then you should be able to browse the coverage reports via: [http://127.0.0.1:8080/lcov-report/](http://127.0.0.1:8080/lcov-report/)

## Pipeline

Currently our github pipeline checks that the linter and the tests are passing with 100% of coverage threshold

## Directories and file names

the nestjs-yalc directory structure is flat to let it be integrated in other projects easily

- tsconfig.\*.json
  - tsconfig.json -> used by the compiler and the IDE
  - tsconfig.test.json -> used by jest
  - tsconfig.dev.json -> used by other dev tools such as eslint
- test.js
- examples/ ->
- docs/ -> used for the the github pages markdown
- [other_libraries]/

### Repo-specific utilities
- `var/asl-test.cjs`: manual AsyncLocalStorage sanity check (Fastify + ALS). Not used by builds/tests; run manually if you need to confirm ALS behaviour across injected requests.
- `build-dist.mjs`: local pack script that writes `dist/package.json` for each package with exports pointing at compiled output. Source `package.json` files stay untouched; the dist `package.json` is generated after `npm run build`. This is a repo-specific helper (not standard npm) to keep local file-based consumption aligned with the compiled layout.
