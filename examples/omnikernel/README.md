# OmniKernel Example

Reusable backend/substrate example.

- `module` is backend-only and protocol-free.
- `app` owns the generated REST and GraphQL API surface.

Use this example to understand how a reusable persistence backend can stay
separate from the application-owned API layer. The app intentionally focuses on
CrudGen API composition over OmniKernel services; the task example is the better
place to study custom service overrides, `YalcEventService`, and `ApiStrategy`.

See [`module/README.md`](./module/README.md) for the substrate and
[`app/README.md`](./app/README.md) for the generated API composition.

Run:

```bash
npm run test:e2e --prefix examples/omnikernel/app
```
