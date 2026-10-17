# Auth session core — acceptance specification v1

Status: pre-implementation acceptance material. This is a portable session-core contract;
proof protocols, identity linking, Nest/HTTP integration and persistent stores are separate
required package slices. No login/provider implementation or generative proof is claimed.

## Purpose and alternatives

Provide a provider-independent session state machine reusable in different applications.
Verified proof adapters, account resolution, transactional storage and clock/randomness
are injected. Application membership and resource permissions remain owned by the consuming application.

A Nest/Passport strategy with stateful sessions is a viable composition; it may implement
a proof adapter. An opaque-session core keeps storage/lifecycle behavior independent of
that choice. A stateless-only JWT login cannot implement immediate server-side logout
without another state/check boundary. No new identity-provider server is introduced.

## Public facade and injected ports

`createAuthCore(options)` returns async `login`, `authenticate`, `refresh`, `logout` and
trusted-host `revokeAll`. This facade is a specification, not a production test helper.

Options: namespace (nonempty stable app/session audience), absoluteTtlMs and idleTtlMs
(positive safe integers with idle <= absolute), exact canonical allowedOrigins, providers
(map from provider ID to async verify(proof)), resolveIdentity, sessions, now and randomBytes. No required setting is silently defaulted. Providers return a verified
`{issuer, subject, authTime, methods}`; authTime is Unix milliseconds, methods is a
nonempty array of bounded strings. Arbitrary hints never reach the identity resolver.
The resolver receives exactly those four fields and returns null or a plain data object with exactly one own enumerable data property `accountId` (nonempty string, at most512 characters); malformed, empty, extra-field or accessor results deny with authentication_denied without invoking getters.
The provider adapter, not an untrusted caller, establishes proof validity. Actual JWT,
OIDC, magic-link and passkey verification have their own required contracts/tests.

`sessions.transaction(callback)` serializes an atomic unit. Its transaction exposes
`getToken(namespace, tokenHash)`, `getSession(namespace, sessionId)`, `putToken(entry)`, `putSession(record)`,
`insertSession(record)`, `insertToken(entry)`, `putEvent(event)` and `listSessions(namespace, accountId)`. Insert operations return false on an existing key and never overwrite it; putSession/putToken update existing records only, and token/session binding cannot be rebound. putEvent is insert-only by (namespace,eventId). A collision rolls the whole transition back and rejects credential_collision (event-ID/storage failures are storage_unavailable), without modifying any existing account/session. Detect equal secret/session draws within one issuance before persisting; repeated full-width random bytes must never expose a session ID as its credential. Reads/writes copy plain data.
The callback is awaited under one transaction/lock and rollback on error is required.
No provider/network/account resolution runs while this lock is held. A refresh-reuse revocation must commit even though the public method rejects: return the denial outcome from the transaction and reject after commit, rather than rolling the revocation back with an exception. SQL/persistent
adapters must prove the same semantics separately; the test fixture is not shippable code.

Token entries: namespace, tokenHash, sessionId, state (`current` or `rotated`). Session
records: namespace, sessionId, accountId, issuer, subject, providerId, authTime, methods,
transport, createdAt, lastSeenAt, expiresAt, csrfHash (cookie only), revokedAt (null or
Unix milliseconds), revision (positive integer, incremented on refresh/revoke, not an idle touch). Outbox events and state commit atomically; failed event insertion rolls back session/token writes. No raw token, proof, email, role or CSRF secret may be persisted.
Store timestamps/IDs are internal contract data, not authorization decisions.

Request context is trusted adapter input `{transport:'cookie'|'bearer', method, origin?,
secFetchSite?, csrf?}`. The HTTP adapter must derive this from its selected configured
transport and actual request; client JSON cannot select bearer to bypass cookie CSRF.
The session itself is bound to transport and namespace, checked on every use.

Login input: `{providerId, proof, context}` only. Use input: `{token, context}` only.
`revokeAll(accountId)` is a trusted-host port, not a public authorization bypass route.
The host must separately authorize it. No browser/HTTP endpoints ship in this module.

Login/refresh result: `{token, csrfToken?, profile}`. Authentication returns only profile.
Profile has exactly accountId, sessionId, issuer, subject, providerId, authTime, methods,
expiresAt. It never contains roles, permissions, email, raw proof or token material.
Logout returns `{revoked:boolean}`; revokeAll returns `{revoked:number}`.
randomBytes(size) returns a Uint8Array of exactly the requested size, at least32 bytes per secret; short/invalid bytes reject invalid_config before a state write. Session/CSRF token strings use unpadded base64url encoding of their random bytes. IDs and secrets are separate draws. All outputs are detached from mutable stored state. Error objects have a stable `code`;
no provider exception text or input credential is returned/emitted.

## Behavioral clauses and acceptance IDs

| Clause | Required behavior | Cases |
|---|---|---|
| AUTH-C01 | Reject missing/invalid configuration, including nonpositive TTLs, idle above absolute, unsafe/noncanonical/wildcard origins and missing ports | A01 |
| AUTH-C02 | Only a configured verifier may produce a proof; rejection, malformed/empty/future claims and provider errors fail closed before a session write | A02,A03,A04 |
| AUTH-C03 | Resolve the exact issuer/subject and normalized authentication context; no email/hint/role mapping or client-selected account; unknown identities deny by default | A05,A06,A07,A38 |
| AUTH-C04 | Each successful login creates a fresh session and unpredictable opaque session/CSRF tokens; runtime randomness uses at least32 cryptographic random bytes per secret | A08,A09,A33,A35,A36,A37,A40 |
| AUTH-C05 | Store only SHA-256 token/CSRF digests and required metadata; no raw proof/token/CSRF/hint in records or emitted events | A10 |
| AUTH-C06 | Read fresh session/revocation state for every use; missing/unknown/rotated/revoked/wrong-namespace/wrong-transport tokens deny | A11,A12,A13,A30,A31 |
| AUTH-C07 | Expire at now >= expiresAt or now >= lastSeenAt+idleTtlMs; successful use touches lastSeenAt without extending absolute expiry; invalid or backward clocks deny | A14,A15,A16 |
| AUTH-C08 | Unsafe cookie login requires exact allowed origin and rejects cross-site; later unsafe cookie use additionally checks the session CSRF token; rejected requests do not touch/revoke state | A17,A18,A19,A32 |
| AUTH-C09 | Bearer sessions require explicit bearer transport and ignore browser cookie/CSRF assumptions; a cookie-bound token never works as bearer | A12,A20 |
| AUTH-C10 | Refresh rotates the opaque token atomically, retaining session/absolute expiry and cookie CSRF secret; the old token stops authenticating | A21 |
| AUTH-C11 | A valid refresh attempt using a rotated token revokes that entire session family; validate transport/origin/CSRF first so a rejected request cannot revoke it | A22,A23 |
| AUTH-C12 | Concurrent refresh has one rotation winner and one reuse rejection; by completion the reused family is revoked, including the winner's token | A24 |
| AUTH-C13 | Logout revokes current session immediately and is idempotent; host revokeAll atomically revokes existing sessions of only that account/namespace | A25,A26,A39 |
| AUTH-C14 | Session failures/events expose stable allowlisted data; storage failures never issue a usable credential; returned profiles cannot mutate stored state | A27,A28,A29,A31,A34,A41 |

Proposal TTL examples in tests are synthetic100ms/1000ms only. No production lifetime or
reserve/billing policy is selected. Actual randomness cannot be established by observing
one sample: source/adapter review must prove crypto entropy; injectable deterministic
randomness is only a fixture. Fixed-shape positive and negative tests are not a statistical
randomness test or a formal worker-isolation proof.

### Exact denial/error semantics

Codes: `invalid_config`, `invalid_input`, `authentication_denied`,
`authentication_unavailable`, `session_denied`, `session_expired`, `csrf_denied`,
`session_reused`, `storage_unavailable`, `credential_collision`. Reject with the appropriate code; no implicit
catch-and-accept path. Provider exceptions map to authentication_unavailable; provider
null/malformed results map to authentication_denied; resolver null is authentication_denied.
Resolver exceptions are authentication_unavailable. Namespace/transport/unknown/revoked
are session_denied; an expired session is session_expired. A nonfinite, nonintegral or
backward now is session_expired on use (invalid_config at construction when detectable).

All methods require a valid context/method. Unsafe means any method other than
GET/HEAD/OPTIONS. login, refresh and logout are unsafe operations and reject safe-method
contexts as invalid_input. Cookie unsafe requests require a nonempty exact allowed origin
and reject secFetchSite=cross-site, even if other fields look valid. Later unsafe uses
require a digest-matching CSRF token. Bearer operations still require the correct method
and namespace/transport; CSRF is a browser-cookie defense, not an API authorization grant.

Refresh reuse is a deliberate conservative policy. Two simultaneous refreshes from one
browser can revoke the family; HTTP clients must serialize refresh and reauthenticate
after a reuse error. A retry must not silently create a second active branch. This tradeoff
is visible in A24 rather than hidden behind a permissive grace interval.

Event record keys: eventId, namespace, kind, at, sessionId, revision, reason. Kinds:
session_created, session_refreshed, session_revoked, session_reused. Each successful
creation/refresh and each newly revoked session writes exactly one stable-ID outbox record
inside the same transaction as its state transition. Event IDs are unique per namespace,
bound to session/revision/kind and cannot be silently overwritten. No event for an aborted
transition remains. Idle touches produce no lifecycle event. Core returns only after the
state+outbox commit; it does not call a separate external emit port or perform delivery.

Host delivery is a separate adapter with at-least-once delivery, stable-ID deduplication
and acknowledgment. A sink crash may repeat delivery of an existing ID; it must not delete
or invent the canonical event. This module promises an atomic durable event record, not
exactly-once external delivery. Persisted storage/delivery adapters and YalcEventService
integration must be separately qualified; in-memory fixtures prove only transaction
semantics. Events contain no provider error messages, proof or credential material.

## Freedoms, integration and proof limits

Internal algorithm and data structures are free within these port/state/atomicity bounds.
Composition via Nest dynamic modules, SQL adapters, external proof protocols and explicit
identity linking are later mandatory package slices; their implementation cannot be hidden
in this module's tests. Never import the test store/baseline from production/build/export.

The conformance harness accepts an explicit candidate factory module, and includes a
labelled unimplemented baseline that produces behavioral RED failures after the harness
loads. Running the baseline does not prove production code exists or has failed tests.
The suite is draft design-gate acceptance material; registration/freezes and the separate
hardened comparison evaluator remain required before implementation/formal GS claims.

## Primary design references

Consulted2026-10-16: [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
for opaque identifiers, server-side storage/lifecycle and expiry; [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
for session-bound tokens and origin defense. The transaction port, strict refresh-reuse
policy and configuration values above are proposed module choices, not quotations or
numeric defaults imposed by those sources. The repository package and agent guidance remain the integration authority.
