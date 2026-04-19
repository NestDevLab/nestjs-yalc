---
title: Getting Started
description: The shortest path from a fresh checkout to a generated NestJS-YALC REST and GraphQL resource.
permalink: /getting-started
---

# Getting Started

This is the shortest useful path through the repository: install dependencies,
run the minimal example, then inspect the one file that composes a generated
REST and GraphQL resource.

## 1. Install the workspace

Run this from the repository root:

```bash
npm ci
```

The workspace uses Node 20, ESM, strict TypeScript, and npm workspaces.

## 2. Run the smallest complete example

```bash
npm run test:e2e --prefix examples/skeleton/app
```

The skeleton app uses an in-memory SQLite database and exposes generated users
and phones APIs. It is the best first reference because it keeps the app small
while still showing REST, GraphQL, service, repository, and dataloader wiring.

## 3. Open the copyable resource definition

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

## 4. Use this mental model

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

## 5. Pick the right next guide

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
