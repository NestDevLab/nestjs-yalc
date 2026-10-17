# Reusable auth SQLite durable store — pre-code contract v1

Status: public pre-code contract for tests-first qualification. It admits no adapter, source freeze, registration, formal GS, package delivery or host integration.

## Port contracts and driver boundary

The session port follows [session-core-v1.md](session-core-v1.md). The directory port follows [directory-core-v1.md](directory-core-v1.md), [directory-core-transaction-outcome-v1.md](directory-core-transaction-outcome-v1.md) and [directory-core-reservation-terminal-v1.md](directory-core-reservation-terminal-v1.md). The exact session-event physical layout selected for this pre-code capsule is in [sqlite-store-outbox-layout-v1.md](sqlite-store-outbox-layout-v1.md); it does not qualify host delivery.

The bounded adapter must use the declared `sqlite3` driver directly with `BEGIN IMMEDIATE` and explicit COMMIT/ROLLBACK receipts. A deferred TypeORM transaction helper does not establish the writer lock before a callback. The adapter must remain compatible with the repository's declared Node 20 support. Its package dependency or peer, locked driver graph, build/export closure, and Node 20 run require separate candidate qualification. No `node:sqlite`, TypeORM transaction wrapper, new dependency, or generic storage framework is introduced by this contract. The execution-input pins for a future source A remain pending canonical selection.

## DS-C01 — Closed factory and lifecycle

The proposed trusted-host API is:

```ts
openAuthSqliteStore(options: {
  mode: 'create' | 'open';
  databasePath: string;
  namespace: string;
  limits: {
    maxLogicalRowsPerNamespace: number;
    maxRowBytes: number;
    maxLogicalBytesPerNamespace: number;
    maxPendingOutboxPerNamespace: number;
    maxQueueDepth: number;
    busyTimeoutMs: number;
    transactionTimeoutMs: number;
  };
  recovery: {
    reconcile(observed: {
      databaseId: string; namespace: string; generation: number;
      transactionId: string; phase: 'pending' | 'committed_unacknowledged' | 'rollback_unacknowledged';
      writeSetDigest: string | null; eventIds: readonly string[];
    }): Promise<
      | {status: 'hold'}
      | {status: 'resolved'; databaseId: string; namespace: string;
          generation: number; transactionId: string;
          outcome: 'committed' | 'confirmed_abort';
          writeSetDigest: string | null; eventIds: readonly string[]; evidenceId: string}
    >;
  };
}): Promise<{
  sessions: SessionStore;
  directory: DirectoryStore;
  close(): Promise<void>;
}>;
```

All fields are required, bounded positive safe integers where numeric, and copied once before I/O. `databasePath` is absolute and points into a host-approved local POSIX directory; no environment path discovery or network filesystem is admitted. **One configured namespace owns one database file in v1.** `create` requires an absent database and publishes a complete versioned schema/namespace identity atomically; `open` requires that exact complete existing database and limits, validates integrity before exposing either port, and never creates, resets, migrates or repairs it. The file and rollback journal use private host-owned permissions; actual ancestor/backup isolation remains a host gate. Wrong namespace, schema, identity, limits, corrupt or missing file refuses. No second namespace can be implicitly admitted to the file. `close()` is bounded and idempotent; it cannot turn an unacknowledged COMMIT into a confirmed abort. An unknown outcome poisons this handle and prevents more writes until a fresh qualified open/reconciliation.

The adapter maintains a private durable recovery-fence row in this same file, separate from both port families' logical row counts. It binds an immutable random `databaseId`, configured namespace, monotonic safe-integer `generation`, unique transactionId, phase, exact affected-row digest and stable event IDs. Database and transaction IDs are 43-character base64url encodings of 32 random bytes; digest is null before known writes or exactly 64 lowercase hex characters, and event IDs form a unique sorted array bounded by the configured row cap. Before invoking either port callback, it commits a `pending` fence for the next generation; competing connections cannot bypass it. The target transaction atomically changes that same generation to `committed_unacknowledged` alongside its state/outbox writes. Only after actual COMMIT acknowledgement does a separate acknowledged metadata transaction clear the fence, after which the port may return success. On callback failure, actual ROLLBACK acknowledgement precedes a durable `rollback_unacknowledged` marker and its acknowledged clear; only then may the session port rethrow the original callback object or the directory port return confirmed_abort. If a crash or lost acknowledgement interrupts any phase, the last durable fence remains. In particular, target COMMIT can be present while its acknowledgement is lost, and no clean marker is written in that target COMMIT.

On fresh `open`, any nonclean fence blocks both ordinary ports before a callback or read, even if the target COMMIT is visible. The required trusted `recovery.reconcile` port receives the exact observed tuple; it is not an arbitrary caller's force-clear flag or a signature service. Both input and result are own plain exact-key data records with no accessor/proxy interpretation; evidenceId is 1–128 ASCII `[A-Za-z0-9_.-]`. `hold`, rejection, malformed/mismatched receipt or unavailable port keeps the fence. A `resolved` receipt must bind the same databaseId/namespace/generation/transactionId, outcome, write-set digest, event IDs and an independently traceable evidenceId. Before clearing, the adapter verifies the current fence and persisted rows/events under a new writer transaction, then CAS-clears **only that generation**; a changed fence refuses. A committed resolution requires matching durable affected rows/receipt/event IDs **and** host reconciliation of dependent external effects. A confirmed-abort resolution requires affirmative completed rollback/recovery evidence from the qualified host, never mere absence of a row, timeout or error tag. If that evidence is unavailable, normal open remains denied; the system does not invent a recovery outcome. The host port and its current process/restore/time evidence are separate DS-I01/DS-I02 qualifications: a copied databaseId/generation from a backup is not current restore authority, and a locally supplied object does not prove authority.

## DS-C02 — Existing ports, no directory policy

`sessions` implements the exact existing `SessionStore.transaction<T>(work):Promise<T>` and its eight `SessionTransaction` methods and existing `TokenEntry`, `SessionRecord`, and `SessionEvent` shapes. It resolves a direct `T` only after confirmed COMMIT. Callback failure or false insert rolls all session/token/outbox writes back; the **same callback error object** is rethrown only after confirmed rollback, preserving the core's private denial identity. Driver failures use a safe storage error without SQL, path or token values. A lost COMMIT acknowledgement never returns `T`, never replays the callback, and poisons the handle; the session port has no fabricated `unknown` return value. Fresh host reconciliation of possible state/outbox is required before dependent external action.

`directory` implements the accepted `DirectoryTx` methods and exactly the amendment's `transaction<T>(namespace,work):Promise<{status:'committed',value:T}|{status:'confirmed_abort'}|{status:'unknown'}>`. It does not implement proof, consent, provisioning, links, grants, capacity settlement, or the seven-method directory facade. Only confirmed COMMIT produces `committed` with the **present** callback value, including a present `value:undefined` when that was the callback result. The outcomes have exact plain-data keys; no extra fields or implicit exception envelope. `confirmed_abort` requires an acknowledged rollback and no remaining commit path. Lost COMMIT acknowledgement, failed rollback, process death, malformed driver result or unclassifiable I/O produces `unknown`; no exception tag or missing receipt is rollback proof. The directory's current handle is fenced. A fresh process may read an exact persisted command receipt/event to establish committed reconciliation; absence alone cannot authorize release. Existing released reservations remain terminal under the accepted amendment.

The configured namespace scopes session operations (whose public transaction has no namespace argument) and must match each persisted row. Directory transaction's namespace argument must equal it; a foreign namespace refuses. Different accounts in this one namespace still compete under the same file lock. A distinct namespace requires its own explicitly created database, not an implicit new tenant. The shared database does not solve the session issuance/binding race or qualify a real host authority port.

## DS-C03 — Atomicity, keys, and snapshots

One bounded in-process queue owns each connection. Every transaction, including reads, obtains `BEGIN IMMEDIATE` before invoking its callback or authoritative read; the SQLite writer lock serializes other processes using the same file. The callback runs once. Prepared statements bind all values. Session token, session and event keys are unique per namespace; inserts never overwrite, updates preserve token/session binding and revisions, and session state plus stable-ID outbox commit together. Directory identity `(namespace,issuer,subject)` and `(namespace,linkId)` are independently unique; command, consent and event IDs are unique; account revision and identity generation updates use exact CAS. All five directory row classes, including acknowledged events, participate in `countRows`; pending count includes only pending events. All reads and writes are detached plain-data snapshots; a failed or caught SQL read/write marks that transaction failed even if its callback returns success. No external proof, funding, event sink or application action runs while the lock is held.

## DS-C04 — Finite logical exposure

The adapter enforces the configured row count, per-row canonical UTF-8 JSON byte bound, total logical bytes and pending-outbox cap before accepting each write. Counts use the same writer transaction and cannot default unknown to zero. It applies the directory's stricter `maxRowsPerNamespace`, `maxRecordBytes`, `maxPendingEvents` and account limits through the existing directory policy; the adapter's physical-row cap covers both port families without reinterpreting directory `countRows`. The queue and transaction/lock waits are finite. A deadline does **not** prove abort: expired work must be unable to issue another SQL statement or COMMIT, and the handle remains fenced until ROLLBACK is completed and acknowledged; otherwise the outcome is unknown. Existing rows, receipts and pending events are never silently pruned to make room or extend a command horizon. A full or unknown count refuses new growth; unpaid, unknown or unacknowledged work remains held and consumes capacity.

These are **logical** bounds. SQLite pages, indexes, rollback journal/WAL, replicas, backups, restore copies and funded retention need separate measured hard-quota and lifecycle acceptance. A logical quote is not physical funding proof. The adapter must not advertise unlimited commands or h24 service from finite counters alone.

## DS-C05 — Outbox, recovery, and lifecycle boundary

Both port families atomically retain only their allowlisted event rows with stable IDs. Session delivery is a separate host adapter with at-least-once delivery and sink deduplication; the session port has no acknowledgement method. Directory `acknowledgeEvent` changes pending count only after qualified stable-ID sink acknowledgement, within its transaction. Duplicate delivery must reuse the same event ID and cannot invent or delete state. The trusted host owns expired command/consent/acknowledged-event compaction, terminal reservation evidence, monotonic clock and restore fencing. It may compact only after the accepted directory deadline, durable sink acknowledgement and terminal funding state; pending events, unknown transactions and unresolved reservations are never reclaimed by age alone. These host lifecycle and physical-funding gates remain outside this adapter's two-port qualification.

The [case matrix](sqlite-store-cases-v1.md) names the real-file/process probes and the separate host gates. Synthetic in-memory session/directory fixtures do not satisfy them. The adapter source, package/build/CI closure, Node 20 run, independent review and actual authority integration remain unqualified.
