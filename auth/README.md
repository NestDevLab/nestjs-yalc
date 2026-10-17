# @nestjs-yalc/auth

`createAuthCore` provides an opaque, provider-independent session lifecycle. It accepts
verified proof, account resolution, transactional session storage, a clock and cryptographic
random bytes as injected host ports. The package does not expose HTTP routes, proof
protocols, identity provisioning or a persistent storage adapter.

```ts
import { randomBytes } from "node:crypto";
import { createAuthCore } from "@nestjs-yalc/auth";

const core = createAuthCore({
  namespace: "my-app",
  absoluteTtlMs: 86_400_000,
  idleTtlMs: 3_600_000,
  allowedOrigins: ["https://app.example"],
  providers,
  resolveIdentity,
  sessions,
  now: Date.now,
  randomBytes,
});
```

The host must bind the request context to its actual cookie or bearer transport. Cookie
mutations require an exact configured origin, reject cross-site requests and verify the
session CSRF secret. The host must authorize `revokeAll` separately. The injected
`sessions.transaction` must serialize, commit and roll back session, token and outbox
changes atomically; an in-memory test fixture is insufficient for production. Tokens
and CSRF secrets are stored only as SHA-256 digests. Host event delivery uses the
committed outbox and needs its own deduplication and acknowledgment proof.

See the [session-core contract](https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/auth/session-core-v1.md) for the full
port, lifecycle and error contract. Refresh reuse revokes the session family, including
when simultaneous refresh attempts race. Clients should serialize refresh attempts.

## Identity directory

`createIdentityDirectory` is available from `@nestjs-yalc/auth` and
`@nestjs-yalc/auth/directory`. The existing `@nestjs-yalc/auth/core` export is unchanged.
The factory accepts `DirectoryOptions` and returns exactly seven async methods:
`resolveIdentity`, `provision`, `link`, `unlink`, `list`, `reconcile`, and
`assertCurrentLink`. All ports and positive mechanical limits are required.

This is a trusted host API. The host supplies proof verification, canonical issuer
routes, current session authentication and binding, application authorization,
command-bound provisioning approval and consent, capacity admission, a trusted clock,
randomness, and a serialized atomic directory store. Session contexts are detached,
bounded plain JSON data. The directory stores exact issuer/subject mappings; it never
creates accounts or matches email, display name, phone or roles. Provisioning requires
current approval for a pre-existing account. Same-account relinking advances the
identity generation; it cannot revive an old session binding or transfer an identity.

Call `assertCurrentLink` at every protected session use, refresh, privileged dispatch
and outbox delivery boundary. Its result is a snapshot, not a reusable authorization.
The host verifier must reject provider aliases before calling the unchanged session
core's four-field resolver. Disabling a provider also requires host-owned last-method
and recovery handling. Provider disablement or revocation after the last observable
check may race with an in-flight operation.

The store implements the explicit `TransactionOutcome<T>` protocol: only `committed`
returns a usable value, `confirmed_abort` proves rollback, and `unknown` or any thrown,
malformed or mismatched outcome fences writes on that directory handle. Callback
completion and error tags do not establish commit or rollback. The store must durably
serialize each namespace, enforce unique identity/link/command/consent/event keys and
CAS generations/revisions, and roll all five logical row classes back together.

The host issues each command ID once as `<issuedAt>.<nonce>`, with a canonical safe
millisecond timestamp and the unpadded base64url encoding of 32 random bytes. Keep that
ID across retries and bind its exact issue time and deadline into approval or consent.
The configured replay window is immutable for a namespace. Expired IDs fail before
storage or funding calls, even if old receipts remain in a backup.

Growth is admitted against the exact five-row `auth-directory.rows.v3` footprint and
finite replay deadline. Each sorted-key UTF-8 JSON row must fit `maxRecordBytes`.
Logical row counts include acknowledged events and tombstones; pressure denies growth
without pruning. A confirmed abort releases its exact held reservation; a committed
receipt settles it. Released reservations are terminal. Unknown outcomes retain holds;
a missing receipt never proves an abort. Reconcile an uncertain command using a fresh
qualified store and current session authority, or fresh proof plus repeatable current
provisioning approval. Do not replace an unresolved command with a new one.

See the [directory contract](../docs/auth/directory-core-v1.md),
[transaction amendment](../docs/auth/directory-core-transaction-outcome-v1.md) and
[reservation amendment](../docs/auth/directory-core-reservation-terminal-v1.md).
The pure directory and synthetic tests do not qualify a persistent adapter, physical
funding or service availability. Real host gates DIR-I01–DIR-I03 remain mandatory:
provider-route integration; session binding, trusted-time restart/restore fencing;
and durable COMMIT/rollback, terminal capacity reconciliation, stable-event sink
acknowledgement/deduplication and lifecycle compaction. These adapters, event delivery,
Nest/HTTP integration, proof protocols and runtime admission are outside this package.
