# Task Example

Advanced CrudGen-first application composition.

- `module` contains task-domain DTOs/entities.
- `app` persists through OmniKernel and exposes generated REST/GraphQL with
  service and dataloader overrides.

Use this example after the skeleton and OmniKernel examples. It demonstrates
how a real app composes generated CRUD APIs, an OmniKernel-backed persistence
layer, targeted service overrides, domain events, HTTP-aware errors, logging,
and module-owned `ApiStrategy` clients without returning to handwritten CRUD
controllers/resolvers.

See [`app/README.md`](./app/README.md) for the runnable app details.

Run:

```bash
npm run build --prefix examples/task/app
npm run test:e2e --prefix examples/task/app
```
