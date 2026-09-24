# Change requests

`@nestjs-yalc/change-requests` stores proposed edits to arbitrary domain entities. A request groups items for one entity. Each open item owns one `(entityType, target, entityId, fieldKey, variant)` combination; a new proposal replaces the old item. `variant` is an empty string when absent. Published, rejected, withdrawn, and replaced items are deleted. The package supplies no HTTP or GraphQL transport.

## Host setup

Add `ChangeRequestEntity` and `ChangeRequestItemEntity` to the host DataSource entities, and `CreateChangeRequests1727164800000` to its migrations. Disable TypeORM `synchronize` in production. Import `TypeOrmModule.forRoot(...)`, `EventEmitterModule.forRoot()`, and an `EventModule.forRootAsync(...)` configuration that exports `YalcEventService`, then import `ChangeRequestModule.forRoot([adapter], [eventsModule])`. `forRootAsync({ imports, inject, useFactory })` also accepts adapter factories. `ChangeRequestAdapterRegistry.register(adapter)` adds or replaces a target at runtime. The host must provide `YalcEventService` in the module's injection scope via an exported module in `imports`.

```ts
const adapter: ChangeRequestAdapter = {
  entityType: 'article', target: 'headline',
  async describe(entityId) { return { label: entityId, adminUrl: `/articles/${entityId}` }; },
  async read(entityId, items) {
    return items.map(({ fieldKey, variant }) => ({ fieldKey, variant: variant ?? '', value: currentValue(entityId, fieldKey, variant ?? '') }));
  },
  async validate(entityId, items) { await validateArticleEdits(entityId, items); },
  async apply(entityId, items, actor) { await updateArticleThroughDomainService(entityId, items, actor); },
};
```

Call `create` with a proposer and nonempty items. Pass an explicit actor to `update`, `approve`, `reject`, `withdraw`, `refresh`, and `retryPublish`; the service never reads request context. `get` returns base, live, and proposed values. `list` accepts entity, target, state, offset, and limit filters and returns a page, total matching requests, and the open item count across all matching requests. `approve` returns a status for each selected item. A live value equal to the proposed value resolves without another write, including after an apply/delete interruption. Other live changes make the item stale until `refresh`. Apply failures retain the item as `publish_failed` with a safe generic error; `retryPublish` invokes the same guarded approval path. An optional `reject` note is saved on the request before selected items are deleted; a host audit journal can retain deleted rows.

The migration uses a plain unique index and a foreign key with cascade deletion. It selects `datetime` on SQLite and `timestamp` on Postgres. Values and source metadata use TypeORM `simple-json`; adapters should return JSON compatible values. The SHA-256 hash is over JSON serialization, so adapters should return stable object key order for object values. The service emits `change-request.created`, `updated`, `approved`, `rejected`, `withdrawn`, `stale`, and `publish_failed` with IDs and counts only. The host remains responsible for authorization of decision operations and for publication side effects inside `apply`.
