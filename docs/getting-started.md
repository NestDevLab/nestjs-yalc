---
title: Getting Started
description: The shortest path from a fresh checkout to a generated NestJS-YALC REST and GraphQL resource.
permalink: /getting-started
---

# Getting Started

This guide starts with the npm install path for application consumers, then
covers the repository workflow for running the examples and inspecting the one
file that composes a generated REST and GraphQL resource.

## 1. Install from npm

For a new application that wants the aggregate package, install the full
framework:

```bash
npm install @nestjs-yalc/framework
```

Install only focused packages when you want to keep the dependency surface
smaller:

```bash
npm install @nestjs-yalc/crud-gen
npm install @nestjs-yalc/event-manager @nestjs-yalc/errors @nestjs-yalc/logger
npm install @nestjs-yalc/observability
npm install --save-dev @nestjs-yalc/jest @nestjs-yalc/jest-config
```

Install the NestJS, TypeORM, GraphQL, OpenTelemetry, or testing peer
dependencies required by the modules you enable. See
[Consumer installation](./npm-publication.md#consumer-installation) for the
publication and package details.

## 2. Install the repository workspace

Run this from the repository root:

```bash
npm ci
```

The workspace uses Node 20, ESM, strict TypeScript, and npm workspaces.

## 3. Run the smallest complete example

```bash
npm run test:e2e --prefix examples/skeleton/app
```

The skeleton app uses an in-memory SQLite database and exposes generated users
and phones APIs. It is the best first reference because it keeps the app small
while still showing REST, GraphQL, service, repository, and dataloader wiring.

## 4. Open the copyable resource definition

Start with:

```text
examples/skeleton/app/apps/skeleton-app/src/users/users.resource.ts
```

That file uses `CrudGenResourceFactory` to compose:

- backend providers
- generated GraphQL resolver providers
- generated REST controllers
- service override wiring
- dataloader wiring
- GraphQL query and mutation customization

## 5. Use this mental model

```text
entity + DTO metadata
  -> CrudGenResourceFactory
    -> shared service/repository/dataloader layer
      -> generated REST controller
      -> generated GraphQL resolver
```

Keep this order when designing a new resource:

1. Describe the model with `ModelObject` and `ModelField`.
2. Generate the resource with `CrudGenResourceFactory`.
3. Add `extraArgs`, `extraInputs`, decorators, readonly mode, or custom query options when the generated surface needs knobs.
4. Override the service or repository when business logic or persistence behavior changes.
5. Write a manual controller or resolver only when the API contract is no longer CRUD-shaped.

## 6. Pick the right next guide

- [Factory reference](./crud-gen-factory.md): learn which factory to use for backend-only, GraphQL-only, REST-only, or full-resource composition.
- [Modeling metadata](./crud-gen-modeling.md): understand `ModelObject`, `ModelField`, DTO separation, aliases, joins, and relation metadata.
- [Backend blueprint](./backend-blueprint.md): follow the opinionated project playbook for new NestJS-YALC backends.
- [Documentation index](./documentation.md): find the full wiki, examples, runtime libraries, publication notes, and repo commands.

## First application recipe

For a new application, prefer this baseline:

```ts
const userResource = CrudGenResourceFactory({
  entityModel: UserEntity,
  backend: {
    service: { dbConnection: "default" },
    dataloader: { databaseKey: "id" },
  },
  graphql: {
    resolver: {
      dto: UserType,
      input: {
        create: UserCreateInput,
        update: UserUpdateInput,
        conditions: UserCondition,
      },
      prefix: "Users_",
    },
  },
  rest: {
    dto: UserType,
    path: "users",
    idField: "id",
  },
});
```

Then spread `userResource.providers` into module providers and
`userResource.controllers` into module controllers.
