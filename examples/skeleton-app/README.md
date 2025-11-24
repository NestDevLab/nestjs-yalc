# Skeleton App (SQLite + NestJS-YALC)

This example app shows how to wire **NestJS-YALC** building blocks into a small SQLite-backed service. It is designed to be a clean starting point that you can copy or extend to bootstrap your own app.

## Features

- **CRUD-Gen REST**
  - `UsersController` generated via `crudRestControllerFactory`:
    - `GET /users` — paginated list (with `pageData`).
    - `GET /users/:guid` — get by id.
    - `POST /users` — create user.
    - `PUT /users/:guid` — update user.
    - `DELETE /users/:guid` — delete user.
  - Backed by `SkeletonModule.register('default')` entities/services (`SkeletonUser`, `SkeletonPhone`).

- **CRUD-Gen GraphQL**
  - Auto-generated resolvers from `examples/skeleton-module`:
    - `SkeletonModule_createSkeletonUser`, `SkeletonModule_updateSkeletonUser`, `SkeletonModule_deleteSkeletonUser`.
    - `SkeletonModule_getSkeletonUserGrid` with filtering and pagination.
  - Join example: `SkeletonUserType.SkeletonPhone` resolved via dataloader.

- **EventManager + Errors**
  - `UsersErrorsController` demonstrates HTTP-aware errors via `YalcEventService`:
    - `GET /users/errors/bad-request` → `errorBadRequest` (400).
    - `GET /users/errors/not-found` → `errorNotFound` (404).
  - Errors are logged with structured payloads and safe HTTP responses.

- **Logger**
  - `UsersLoggingController` injects the event logger (`EVENT_LOGGER`) as an `ImprovedLoggerService` and logs a structured message:
    - `GET /users-logging`.

- **ApiStrategy (HTTP)**
  - `UsersProxyService` + `UsersProxyController` use `NestHttpCallStrategy`:
    - Provider: `NestHttpCallStrategyProvider('USERS_HTTP_STRATEGY', { baseUrl: '' })`.
    - Endpoint: `GET /users-proxy` (calls `/users` through the strategy).
  - In e2e tests, the underlying `HttpService` is mocked to loop back into the Nest HTTP server (no real HTTP).

- **Validation + Field Middleware**
  - DTOs in `apps/skeleton-app/src/users/users.dto.ts` use:
    - `@StringFormatMatchValidation` with `StringFormatEnum.ALPHA` for names.
    - `@IsEmail`, `@MinLength` for email/password.
    - `@DateValidation` example for timestamps.
  - `UsersValidationController`:
    - `POST /users-validation` — validates `CreateUserDto` with a `ValidationPipe` and creates a user via `GenericService`.

## Structure

- `apps/skeleton-app/src/app.module.ts`
  - GraphQLModule (Apollo) with `autoSchemaFile`.
  - TypeORM SQLite in-memory DB (`SkeletonUser`, `SkeletonPhone`).
  - Skeleton GraphQL module: `SkeletonModule.register('default')`.
  - `UsersModule` with REST controllers and strategy wiring.

- `apps/skeleton-app/src/users`
  - `users.rest.controller.ts` — REST CRUD via factory.
  - `users.errors.controller.ts` — EventManager + HTTP errors.
  - `users.proxy.service.ts` / `users.proxy.controller.ts` — ApiStrategy example.
  - `users.logging.controller.ts` — logger example.
  - `users.validation.controller.ts` + `users.dto.ts` — DTO + validation + field-middleware.
  - `users.module.ts` — wires SkeletonModule, HttpModule, CLS, EventModule.

## Running tests

From the workspace root (`workspaces/nestjs-yalc`):

- Full checks (lint + build + unit + e2e):
  - `npm run ci:checks`
- Only e2e for this app:
  - `npm run test:e2e --prefix examples/skeleton-app`

## Using this as a starting point

- Copy `examples/skeleton-app` into your project, or use it as a template.
- Replace `SkeletonUser`/`SkeletonPhone` with your own entities and DTOs, keeping:
  - CRUD-Gen wiring (service + resolver + controller factory).
  - EventManager and logger setup if you want consistent logging/error handling.
  - ApiStrategy wiring if you need HTTP or local-call strategies.

The goal is to keep this app small, coherent, and easy to extend or clone, not a dumping ground for experiments. Each controller in `src/users` demonstrates a specific library feature in isolation.***
