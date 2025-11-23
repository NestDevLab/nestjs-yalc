# CRUD-Gen REST Usage

GraphQL is the primary focus, but CRUD-Gen includes REST helpers for pagination/sorting and Swagger-friendly responses.

## DTOs and params
- Use `crudGenRestParamsFactory(entityModel?, defaultValue?)` to get a query DTO with `startRow`/`endRow` and sort model (`sortModelRestFactory` auto-enums entity fields).
- `crudGenRestParamsNoPaginationFactory` builds a DTO without pagination when you only need sorting.
- `CGRestQueryArgs` / `CGQueryArgsNoPagination` combine Nest `@Query` params, optional extra args, and mapping into `CrudGenFindManyOptions`.
- `PageData` and `PaginatedResultDto` shape paginated responses; `ApiOkResponsePaginated(dto)` decorates Swagger responses with `nodes` + `pageData`.

## Mapping requests to find options
- `mapCrudGenRestParams`/`CrudGenRestArgsFactory` reuse the same mapping as GraphQL (`mapCrudGenParam`) to turn query params into TypeORM-friendly `CrudGenFindManyOptions`.
- Extra args behave like GraphQL: declare them in `extraArgs` and they are exposed as query params unless `hidden`.

## Controllers
- Apply `CGQueryArgs` to controller methods to receive mapped `CrudGenFindManyOptions`.
- Pair with your service (e.g., a `GenericService` created via `CrudGenDependencyFactory`) and return `PaginatedResultDto`.
- Swagger: decorate with `ApiOkResponsePaginated(MyDto)` to document the paginated shape.
- If you want a ready-made REST controller, use `crudRestControllerFactory({ entityModel, dto?, path?, decorators?, query? })`, then register the returned class inside your module `controllers`. It wires list + getById using the `GenericService` and the same sorting/pagination helpers.

## Notes
- Filters via REST are not fully implemented yet (placeholders exist in the DTO factories); prefer GraphQL for advanced filters.
- Sorting uses entity field names; ensure your DTO exposes the same names you expect in the controller.
- Alternative: you can expose REST via GraphQL Sofa (see `docs/api-creation.md` note). Use Sofa if you want a fully automatic REST layer from GraphQL; use the controller factory if you need explicit paths, guards, or bespoke DTOs.
