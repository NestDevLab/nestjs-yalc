# CRUD-Gen REST Usage

GraphQL is still the richest generated surface, but CRUD-Gen includes REST
helpers for generated CRUD controllers, pagination, sorting, filtering, and
Swagger-friendly responses.

## DTOs and params
- Use `crudGenRestParamsFactory(entityModel?, defaultValue?)` to get a query DTO with `startRow`/`endRow`, `sorting`, and `filters`.
- `sorting` and `filters` are accepted as JSON-encoded query parameters by generated REST controllers.
- `crudGenRestParamsNoPaginationFactory` builds a DTO without pagination when you only need sorting.
- `CGRestQueryArgs` / `CGQueryArgsNoPagination` combine Nest `@Query` params, optional extra args, and mapping into `CrudGenFindManyOptions`.
- `PageData` and `PaginatedResultDto` shape paginated responses; `ApiOkResponsePaginated(dto)` decorates Swagger responses with `nodes` + `pageData`.

## Mapping requests to find options
- `mapCrudGenRestParams`/`CrudGenRestArgsFactory` reuse the same mapping as GraphQL (`mapCrudGenParam`) to turn query params into TypeORM-friendly `CrudGenFindManyOptions`.
- `startRow` and `endRow` are parsed as numbers from HTTP query strings.
- `sorting` and `filters` are parsed from JSON when passed as strings. Malformed JSON returns a `400 Bad Request`.
- Extra args behave like GraphQL: declare them in `extraArgs` and they are exposed as query params unless `hidden`.
- For generated REST controllers, flat query params such as `?projectId=...` or `?guid=...` are now mapped as simple equality filters on top of the normal pagination/sorting mapping. This keeps common CRUD list endpoints usable without inventing bespoke controller methods for every resource.

Example structured REST query:

```http
GET /users?sorting=[{"colId":"firstName","sort":"ASC"}]&filters={"expressions":[{"text":{"field":"firstName","type":"contains","filter":"Alice","filterType":"text"}}]}
```

When building URLs manually, JSON values must be URL-encoded by the client.
`supertest` and most HTTP clients do this automatically when using a query
object.

## Controllers
- Apply `CGQueryArgs` to controller methods to receive mapped `CrudGenFindManyOptions`.
- Pair with your service (e.g., a `GenericService` created via `CrudGenDependencyFactory`) and return `PaginatedResultDto`.
- Swagger: decorate with `ApiOkResponsePaginated(MyDto)` to document the paginated shape.
- If you want a ready-made REST controller, use:
  - `crudRestControllerFactory({ entityModel, dto?, path?, decorators?, query?, idField?, readonly?, mutations? })`
  - register the returned class inside your module `controllers`.
  - By default it wires **full CRUD** using `GenericService`:
    - `GET /path` → `getEntityListExtended` (with pagination helpers)
    - `GET /path/:id` → `getEntity`
    - `POST /path` → `createEntity`
    - `PUT /path/:id` → `updateEntity`
    - `DELETE /path/:id` → `deleteEntity` (returns `{ deleted: boolean }`)
  - Set `readonly: true` to expose only the read endpoints (`GET` list + `GET :id`).
  - Use `mutations?: { create?: { disabled?: boolean; decorators?: IDecoratorType[] }; update?: { ... }; delete?: { ... } }` to disable individual write endpoints or attach guards/interceptors specifically to them.
  - See `examples/skeleton/app` for the minimal `CrudGenResourceFactory` path that composes REST, GraphQL, service, repository, and dataloader providers from one app-owned resource definition.
  - See `examples/omnikernel/app` for generated REST controllers over a reusable OmniKernel backend.

## Notes
- REST supports **simple equality filters** via flat query params on generated controllers.
  - Example: `GET /tasks?projectId=<uuid>`
  - Example: `GET /projects?guid=<uuid>`
- REST supports structured JSON `filters` for standard generated list endpoints.
- Plain TypeORM fallback supports straightforward structured filters by normalizing CrudGen's internal `filters` / `childExpressions` shape before calling `find` / `findAndCount`.
- Nested `OR` filters inside `AND` expressions still require an extended repository/query override because TypeORM's plain find options cannot represent every CrudGen expression tree.
- Sorting uses entity field names; ensure your DTO exposes the same names you expect in the controller.
- If a resource uses a custom service provider, pass `serviceToken` to `crudRestControllerFactory`; otherwise the factory assumes the default `getServiceToken(entityModel)` provider.
- Alternative: you can expose REST via GraphQL Sofa (see `docs/api-creation.md` note). Use Sofa if you want a fully automatic REST layer from GraphQL; use the controller factory if you need explicit paths, guards, or bespoke DTOs.
