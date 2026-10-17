# Directory transaction outcome — bounded design amendment

Status: public pre-code amendment. This supersedes only the transaction outcome boundary
of [the directory contract](directory-core-v1.md). The 44 cases and three real-host
integration gates remain required. It creates no adapter, implementation, registration,
GS or new authority.
An arbitrary thrown error tag is not proof of rollback.

## Exact trusted-port protocol

Replace the earlier `DirectoryStore.transaction<T>(namespace,work):Promise<T>` return
contract with:

```ts
type TransactionOutcome<T> =
  | {status:'committed';value:T}
  | {status:'confirmed_abort'}
  | {status:'unknown'};
type DirectoryStore = {
  transaction<T>(namespace:string,work:(tx:DirectoryTx)=>Promise<T>):
    Promise<TransactionOutcome<T>>;
};
```

These are exact own plain records with enumerable data fields, no symbols, accessors,
extra/missing keys or implicit coercion. Validate descriptors before reading. `value`
is present only for committed, is the detached result of that invocation's callback,
and must satisfy the caller's expected bounded result schema. A callback intentionally
returning undefined may have a present value:undefined; it is not a missing value field.
The adapter cannot substitute another invocation's result. All existing transaction
serialization, row uniqueness/CAS, detached snapshots and all-or-nothing writes remain.

The qualified adapter alone owns the store boundary:

| Outcome | Required meaning | Directory behavior after a growth hold |
|---|---|---|
| committed | The callback completed and every transaction write is durably committed; this is not just callback completion or a submitted COMMIT | Accept validated result and use idempotent settle for the exact reservation/command |
| confirmed_abort | The adapter has authoritative confirmation that none of this transaction's writes committed or remain able to commit | Release only through releaseConfirmedAbort, then reject with the safe callback error if one occurred, otherwise storage_unavailable |
| unknown | Commit or rollback outcome cannot be established, including lost acknowledgement | Keep reservation, reject commit_unknown and fence handle writes pending qualified reconciliation |

A promise rejection is always unclassified/unknown regardless of Error.code, message,
class, timing or a callback-return flag. It cannot release a hold. A malformed outcome,
committed after a callback failure, an invalid/mismatched committed value, or any unknown
status is also unknown; do not read attacker accessors or expose raw exception text.
The module may privately capture its own bounded callback error so a later explicit
confirmed_abort preserves identity_conflict, consent_denied, capacity_exceeded or other
specified safe denial. An adapter must catch callback failures, finish/confirm rollback,
and return confirmed_abort; if rollback cannot be confirmed it returns unknown. The
callback's error or an insert returning false alone is not rollback acknowledgement.

Read-only directory transactions use the same protocol. Only committed yields a usable
read result; confirmed_abort is a safe failure, and unknown never becomes null or an empty
directory. An unknown handle fences future writes even if that invocation held no growth
reservation. Nothing cancels an already-authorized in-flight application action.

## Reconciliation and fixture limits

A fresh qualified store may expose a matching durable command receipt through a committed
read outcome. That permits idempotent committed reconciliation for its exact reservation.
A committed read containing no receipt proves only absence at that read, never a confirmed
abort of an earlier unknown transaction. Confirmed-abort reconciliation requires the
host adapter's own authoritative completed transaction/rollback evidence under DIR-I03;
the directory facade has no public force-release or arbitrary outcome assertion input.
Expired commands still fail under the immutable command horizon; host-owned uncertain
reservation reconciliation cannot revive expired commands or bypass current grants.

The neutral in-memory fixture may return the three exact outcomes to exercise module
branching. It may model a lost acknowledgement after applying its local snapshot, or an
explicitly aborted callback with no applied snapshot. These are injected trusted-port
facts only. DIR-T37 must prove release occurs only after explicit confirmed_abort;
DIR-T38 must prove unknown or a thrown/malformed outcome retains the hold and that a
missing receipt does not release it. No fixture tag proves actual disk durability.
Real fresh-process COMMIT/rollback acknowledgement, fault/crash/restore and economic
reservation reconciliation remain mandatory DIR-I03 evidence before host production.
The real adapter must be admitted for this protocol; any existing store API needs its
own qualified translation rather than being assumed compatible.
