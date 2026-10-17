# Directory transaction-phase acceptance correction

This separate test capsule preserves every byte in the original `test/auth/directory-core` freeze and the registration receipt. It corrects fault targeting in DIR-T24/T37/T38: unknown or malformed results intended for a reserved mutation now apply only after that transaction attempted a write. Earlier read transactions must still return committed outcomes. The separate global read-unknown case remains unchanged and requires no reservation.

All 44 original case IDs and assertions are retained. The fixture adds only a trusted test control, not a production API. `phase-controls.test.mjs` discriminates the original fixture from this correction, including failed write attempts, lost COMMIT acknowledgment and committed-after-callback-failure responses. The original fixture has eight failures and two positive controls; the corrected fixture passes all ten controls.

This correction was qualified during ordinary implementation after the original pre-code baseline. It is not retroactive pre-code RED, a replacement source registration, formal generative qualification or real-host admission. An ordinary candidate retaining fail-closed read behavior originally passed 41 of 44 cases; the other three had the independently reproduced phase defect. Those original observations remain valid historical evidence.

```sh
node --test --test-reporter=tap test/auth/directory-core-phase-v1/phase-controls.test.mjs
node --test --test-reporter=tap test/auth/directory-core-phase-v1/conformance.test.mjs
```

The conformance default remains the explicit unimplemented baseline: 44 controlled failures, no skips. Set `YALC_AUTH_DIRECTORY_CANDIDATE` to the actual absolute compiled ESM entry exporting `createIdentityDirectory` to observe a candidate. Set `DIRECTORY_FIXTURE_CANDIDATE` to the absolute original `test/auth/directory-core/fixtures.mjs` to reproduce the eight harness-control failures. The original manifest and receipt remain authoritative for their original inputs; this capsule manifest binds only this separately reviewed harness correction. Provider, session-binding, persistence, funding and lifecycle host gates remain separate.
