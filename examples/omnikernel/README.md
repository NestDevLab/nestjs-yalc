# OmniKernel Example

This example separates the reusable OmniKernel persistence substrate from the
app-owned REST and GraphQL surface.

- [`module`](./module/README.md) is a private, buildable workspace package.
  It owns scoped entities, services, repositories, dataloaders, indexes, and
  relation contracts.
- [`app`](./app/README.md) composes those exports with CrudGen to expose the
  generated API surface.

The module uses server-owned scope isolation. Applications must derive scope
from a trusted request boundary; clients do not choose a `scopeId` in a DTO or
query. The raw payload contract is portable JSON storage, not a substitute for
the typed scoped projection contract.

Run the normal example suite:

```bash
npm run test:e2e --prefix examples/omnikernel/app
```
