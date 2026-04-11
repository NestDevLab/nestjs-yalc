# Skeleton Example

Minimal CrudGen-first example.

- `module` contains the simple user/phone model package.
- `app` composes generated REST, generated GraphQL, services, repositories, and
  dataloaders with `CrudGenResourceFactory`.
- The app also contains small non-CRUD examples for validation,
  `YalcEventService`, and `ApiStrategy`.

Use this example to learn the default path before studying the reusable
OmniKernel substrate or the advanced task composition. See
[`app/README.md`](./app/README.md) for the runnable app details and
[`module/README.md`](./module/README.md) for the model package.

Run:

```bash
npm run test:e2e --prefix examples/skeleton/app
```
