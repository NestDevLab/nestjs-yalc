# Task Example

Advanced CrudGen-first application composition.

- `module` contains task-domain DTOs/entities.
- `app` persists through OmniKernel and exposes generated REST/GraphQL with
  service and dataloader overrides.

Run:

```bash
npm run build --prefix examples/task/app
npm run test:e2e --prefix examples/task/app
```
