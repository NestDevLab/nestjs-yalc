# Auth directory pre-code capsule

The [contract](../../../docs/auth/directory-core-v1.md), [cases](../../../docs/auth/directory-core-cases-v1.json), [transaction outcome amendment](../../../docs/auth/directory-core-transaction-outcome-v1.md), and [terminal reservation amendment](../../../docs/auth/directory-core-reservation-terminal-v1.md) define the intended trusted-host directory boundary. `manifest.json` binds these public inputs to 44 literal `DIR-T01`–`DIR-T44` cases and nine neutral fixture tests. The four executable `.mjs` files are byte-identical to the reviewed design oracle; this capsule changes paths and publication metadata only.

Run from the repository root:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin LANG=C.UTF-8 node --test --test-reporter=tap test/auth/directory-core/conformance.test.mjs
env -i PATH=/usr/local/bin:/usr/bin:/bin LANG=C.UTF-8 node --test --test-reporter=tap test/auth/directory-core/neutral-fixtures.test.mjs
```

The default `unimplemented-baseline.mjs` deliberately fails all 44 cases as missing behavior; the nine neutral fixture checks pass. For a later candidate, set `YALC_AUTH_DIRECTORY_CANDIDATE` to an absolute ESM entry path exporting `createIdentityDirectory(options)`. That trusted-host factory must expose exactly seven async methods: `resolveIdentity`, `provision`, `link`, `unlink`, `list`, `reconcile`, and `assertCurrentLink`. The prospective source location is `auth/src/directory/index.ts`; it does not exist in this pre-code capsule. Package exports, build wiring, and type/public consumer closure require separate review before implementation delivery.

The fixture models controlled host ports, serialized in-memory transactions, committed/confirmed-abort/unknown outcomes, funding effects, and explicit acknowledgement/compaction transitions. It does not implement directory policy. The three excluded real-host gates `DIR-I01`–`DIR-I03` cover provider alias rejection, session binding/trusted-time restore, and durable store/outbox/capacity reconciliation. Local tests do not qualify those integrations, a funded physical service, source registration, formal GS, or runtime admission. The acceptance authors are excluded from implementing the production directory.
