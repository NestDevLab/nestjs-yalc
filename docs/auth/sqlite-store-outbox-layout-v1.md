# Session outbox physical layout — pre-code provision v1

DS-T04/DS-T18 must observe an exact stable session event after a process restart and distinguish a duplicate from a second durable row. `SessionTransaction` deliberately has no `getEvent` or acknowledgement method. This selected pre-code layout supplies the bounded read-only observation surface. A query that discovers arbitrary user tables and searches arbitrary JSON text is not sufficient: it could match a copy in unrelated metadata or miss an encoded outbox. This provision is not a production API, adapter implementation, source freeze, registration, formal GS or DS-I01 sink proof.

The bounded adapter has this one physical read-only inspection surface:

```sql
CREATE TABLE auth_session_outbox (
  namespace TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_json TEXT NOT NULL,
  PRIMARY KEY (namespace, event_id)
) WITHOUT ROWID;
SELECT event_id, event_json
FROM auth_session_outbox
WHERE namespace = ? AND event_id = ?;
```

This table is the **sole authoritative storage** for `SessionTransaction.putEvent` and the session outbox. It is committed atomically with the same transaction's session/token rows and recovery-fence transition. It is not a copied observation table, telemetry projection or second delivery queue. A duplicate `(namespace,event_id)` cannot add a second row or overwrite an old one. The adapter stores the exact `SessionEvent` allowlist—`eventId,namespace,kind,at,sessionId,revision,reason`—as canonical sorted-key, whitespace-free UTF-8 JSON in `event_json`; `event_id` equals the event's stable ID. Proof, raw token/CSRF, provider-return payload, extra fields and unrelated personal data are forbidden in this table.

**Every retained session-event row and its canonical UTF-8 JSON bytes** count against `maxLogicalRowsPerNamespace`, `maxRowBytes`, `maxLogicalBytesPerNamespace` and `maxPendingOutboxPerNamespace` in the same serialized writer transaction as all other rows. A pending session event remains pending until a separately qualified delivery/lifecycle operation; this provision adds no session acknowledgement method. Retained rows consume finite limits until qualified lifecycle processing; no implicit pruning, event-ID reuse or age-based capacity refund follows from a read, restart, timeout or duplicate attempt.

The test opens the database through the qualified installed `sqlite3` driver with `OPEN_READONLY`, sets and reads back `PRAGMA query_only=ON`, binds exact namespace/event ID and checks **one** exact decoded canonical event and count 1. It checks count 0 after rolled-back/false-insert transitions and count 1 after duplicate attempts. A fresh OS process performs each assertion after the originating handle closes. A foreign namespace key returns count 0, and an attempted write on the inspection connection fails without modifying the database. The query is read-only and cannot clear a recovery fence, deliver/acknowledge an event, or qualify the DS-I01 host sink. Schema/version validation and private file/recovery fences remain under reviewed C01/C03.

A different outbox layout requires a separately reviewed pre-code successor before freezing production source A. DS-I01 still requires the real host's stable-ID sink delivery, dedupe and backup/restore evidence.
