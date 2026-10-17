# Reusable auth SQLite store — pre-code acceptance capsule

This capsule exercises the [durable-store contract](../../../docs/auth/sqlite-store-v1.md), its [21-case matrix](../../../docs/auth/sqlite-store-cases-v1.md), and the selected [session-outbox layout](../../../docs/auth/sqlite-store-outbox-layout-v1.md). It contains no adapter or production storage code. The default `unimplemented-baseline.mjs` deliberately fails all 21 DS-T cases with `DS_UNIMPLEMENTED`; seven separate neutral checks must pass on real SQLite files and child processes. These results alone do not establish registration, formal GS, host integration, package qualification or deployment. The frozen manifest binds this ordinary pre-code acceptance packet; implementation still requires its separate registration and receipt.

The candidate must export `openAuthSqliteStore` from an absolute ESM file selected by `YALC_AUTH_DURABLE_CANDIDATE`. The runner also requires an absolute installed `sqlite3/lib/sqlite3.js` path in `YALC_SQLITE3_MODULE`, an existing absolute excluded scratch directory in `YALC_AUTH_DURABLE_SCRATCH`, and an absolute qualified Node 20 binary in `YALC_AUTH_DURABLE_NODE20`. The manifest pins repository toolchain files and execution binary identities; a separate source receipt records the selected canonical base. Machine-local absolute paths are supplied explicitly at execution and never discover private host configuration. Each test removes only its own unique scratch child.

From the repository root after supplying those paths:

```sh
export YALC_SQLITE3_MODULE="$(node -p "require.resolve('sqlite3')")"
export YALC_AUTH_DURABLE_NODE20=/absolute/path/to/qualified/node20
export YALC_AUTH_DURABLE_SCRATCH="$PWD/var/auth-sqlite-oracle"
mkdir -p "$YALC_AUTH_DURABLE_SCRATCH"
node --test test/auth/sqlite-store/neutral-sqlite.test.mjs
node --test test/auth/sqlite-store/conformance.test.mjs
```

Set `YALC_AUTH_DURABLE_CANDIDATE` only to run a separately owned adapter candidate. DS-T21 launches the supplied Node 20 executable, verifies the installed native driver on a real disposable SQLite file, then imports and exercises the candidate. Local Node 24 success does not substitute for it.

DS-N04 intercepts a real successful sqlite3 COMMIT callback in a test child and withholds only the acknowledgement. DS-N06 proves a real driver `SQLITE_ERROR` after an earlier valid write. DS-N07 proves the session-outbox query against a real disposable database: exact key, foreign namespace, uniqueness, rollback absence, and read-only refusal. The private preload files are test instruments, not adapter APIs. Candidate DS-T12/T13 arm ACK interception from inside the transaction callback after its writes. DS-T04/T18 inspect the sole authoritative session outbox in a fresh OS process through `OPEN_READONLY` and `PRAGMA query_only=ON`; they do not infer durable event bytes from a driver call trace.

The three host gates DS-I01/02/03 remain separate: trusted recovery and event-sink deduplication, monotonic time/lifecycle/restore authority, and measured physical database/journal/backup cost. Injected recovery results exercise adapter tuple handling but do not establish host authority. A future green candidate must still qualify source, build, dependency, package, Node 20 and host integration boundaries independently.
