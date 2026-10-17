# Auth directory and linking — pre-code contract v3

Status: public pre-code acceptance contract. Read the [transaction outcome amendment](directory-core-transaction-outcome-v1.md) and [terminal reservation amendment](directory-core-reservation-terminal-v1.md) with this contract; their exact provisions supersede the older transaction return and reservation transitions below. The [44 design cases](directory-core-cases-v1.json) are executable in the adjacent test capsule. This is not implementation, registration, GS, migration, or runtime admission. It composes the auth session core. The host owns accounts, proof verification, sessions, application authority, provider configuration, funded capacity and persistence; this directory owns only exact identity/account links and their transactional command history.

## Closed trusted facade

`createIdentityDirectory(options)` returns exactly `resolveIdentity`, `provision`, `link`, `unlink`, `list`, `reconcile`, and `assertCurrentLink`. It is a trusted-host API, never a browser/HTTP API. All methods are async. Types specify exact records, not permission to accept forged objects.

```ts
type Identity = {issuer:string;subject:string;authTime:number;methods:readonly string[]};
type ProofInput = {providerId:string;proof:string|Uint8Array};
type SessionUse = {token:string;context:unknown}; // context is host-derived
type SessionProfile = {accountId:string;sessionId:string;providerId:string;
  issuer:string;subject:string;authTime:number;methods:readonly string[];expiresAt:number};
type SessionBinding = {namespace:string;sessionId:string;accountId:string;
  issuer:string;subject:string;providerId:string;linkId:string;generation:number};
type GuardResult = {accountId:string;linkId:string;generation:number;accountRevision:number};
type CommandResult = {status:'provisioned'|'linked'|'unlinked';accountId:string;
  linkId:string;revision:number;replay:boolean};
type LinkView = {linkId:string;providerId:string;issuer:string;usable:boolean;linkedAt:number};
type ReconcileScope = {kind:'session';sessionUse:SessionUse} |
  {kind:'provision';proof:ProofInput;enrollmentRef:string};
type Directory = {
  resolveIdentity(identity:Identity):Promise<{accountId:string}|null>;
  provision(input:{proof:ProofInput;enrollmentRef:string;commandId:string}):Promise<CommandResult>;
  link(input:{sessionUse:SessionUse;currentProof:ProofInput;targetProof:ProofInput;
    consent:string;commandId:string}):Promise<CommandResult>;
  unlink(input:{sessionUse:SessionUse;currentProof:ProofInput;linkId:string;
    consent:string;commandId:string}):Promise<CommandResult>;
  list(input:{sessionUse:SessionUse}):Promise<{revision:number;links:LinkView[]}>;
  reconcile(input:{scope:ReconcileScope;commandId:string}):Promise<CommandResult|null>;
  assertCurrentLink(input:{sessionUse:SessionUse}):Promise<GuardResult>;
};
type IdentityRow = {namespace:string;issuer:string;subject:string;providerId:string;
  accountId:string;linkId:string;status:'active'|'unlinked';generation:number;
  linkedAt:number;unlinkedAt:number|null};
type CommandRow = {namespace:string;commandId:string;accountId:string;action:string;
  intentDigest:string;result:CommandResult;reservationId:string;eventId:string;
  expiresAt:number};
type ConsentRow = {namespace:string;consentId:string;commandId:string;expiresAt:number};
type EventRow = {eventId:string;namespace:string;
  kind:'identity_provisioned'|'identity_linked'|'identity_unlinked';
  accountId:string;linkId:string;providerId:string;revision:number;at:number;
  commandId:string;delivery:'pending'|'acknowledged'};
type DirectoryTx = {
  getIdentity(issuer:string,subject:string):Promise<IdentityRow|null>;
  getLink(linkId:string):Promise<IdentityRow|null>;
  listLinks(accountId:string,limit:number):Promise<IdentityRow[]>;
  getAccountRevision(accountId:string):Promise<number|null>;
  getCommand(commandId:string):Promise<CommandRow|null>;
  getConsent(consentId:string):Promise<ConsentRow|null>;
  countRows():Promise<number>;
  countLinks(accountId:string):Promise<number>;
  countCommands(accountId:string):Promise<number>;
  countPendingEvents():Promise<number>;
  insertIdentity(row:IdentityRow):Promise<boolean>;
  updateIdentity(expectedGeneration:number,row:IdentityRow):Promise<boolean>;
  insertCommand(row:CommandRow):Promise<boolean>;
  insertConsent(row:ConsentRow):Promise<boolean>;
  putAccountRevision(accountId:string,expected:number|null,next:number):Promise<boolean>;
  insertEvent(row:EventRow):Promise<boolean>;
  acknowledgeEvent(eventId:string):Promise<boolean>;
};
type DirectoryStore = {transaction<T>(namespace:string,work:(tx:DirectoryTx)=>Promise<T>):Promise<T>};
type Quote = {quoteId:string;upperLogicalBytes:number;admittedLifetimeUntil:number;
  footprintVersion:string};
type Options = {namespace:string;limits:{maxFreshProofAgeMs:number;maxLinksPerAccount:number;
  maxCommandReceiptsPerAccount:number;maxPendingEvents:number;
  maxRecordBytes:number;maxConcurrentCommands:number;replayWindowMs:number;
  maxRowsPerNamespace:number};
  verifyProof:(input:ProofInput)=>Promise<Identity|null>;
  canonicalProviderForIssuer:(issuer:string)=>Promise<{providerId:string;revision:string}|null>;
  authenticateSession:(input:SessionUse)=>Promise<SessionProfile>;
  sessionBinding:(sessionId:string)=>Promise<SessionBinding|null>;
  providerState:(providerId:string)=>Promise<{enabled:boolean;revision:string}>;
  authorize:(input:{action:'link'|'unlink'|'list'|'reconcile'|'guard';namespace:string;
    accountId:string;sessionId:string})=>Promise<{allowed:boolean;revision:string}>;
  provisioningPolicy:(input:{namespace:string;enrollmentRef:string;
    verifiedIdentity:Identity;commandId:string})=>Promise<{accountId:string;approvalId:string;
      commandId:string;issuedAt:number;expiresAt:number}|null>;
  verifyConsent:(input:{receipt:string;action:'link'|'unlink';accountId:string;commandId:string;
    target:{providerId:string;issuer?:string;subject?:string;linkId?:string}})
    =>Promise<{consentId:string;commandId:string;issuedAt:number;expiresAt:number}|null>;
  capacity:{quoteGrowth:(input:{namespace:string;accountId:string;commandId:string;
    intentDigest:string;logicalFootprint:readonly {kind:'identity'|'accountRevision'|'command'|'consent'|'event';upperBytes:number}[];
    replayUntil:number;class:'auth-core'})=>Promise<Quote>;
    reserveGrowth:(input:{namespace:string;accountId:string;commandId:string;
      intentDigest:string;quote:Quote;class:'auth-core'})=>Promise<{reservationId:string}>;
    settle:(reservationId:string,commandId:string)=>Promise<void>;
    releaseConfirmedAbort:(reservationId:string,commandId:string)=>Promise<void>;
    reconcileUnknown:(reservationId:string,commandId:string,
      outcome:'committed'|'confirmed_abort')=>Promise<void>};
  directoryStore:DirectoryStore;now:()=>number;randomBytes:(size:32)=>Uint8Array};
```

All options are required; missing policy never means allow. `verifyProof` is the installed verifier, not request-selected cryptography. `authenticateSession` uses the unchanged session-core current-session path. `authorize` is current application authority, not roles in this package. `provisioningPolicy` is a repeatable current approval lookup for one verified identity, exact commandId and a **pre-existing host-authorized** account; approval consumption occurs in the directory transaction. `verifyConsent` validates an action, target, account and exact-command-bound host receipt. Both return the same commandId and its exact issuedAt/expiresAt parsed below; mismatch, expiry or inability to verify this binding denies. Neither port may rebind an old approval/consent to a new command merely because a retained row expired. `ConsentRow` is the one-use ID ledger for `approvalId` on provision and `consentId` on link/unlink, in one unique namespace. `sessionBinding` is a trusted host sidecar bound when a session is issued; an unbound session cannot do protected work. The issuance/binding race needs a qualified host integration; merely observing a link and later writing a sidecar is insufficient. `DirectoryStore` must durably serialize each namespace and roll all transaction writes back together. External proof, capacity and event delivery calls never occur inside that transaction.

ReservationId, quoteId and provider/policy revision strings are 1–128 ASCII `[A-Za-z0-9_.-]`; all other persisted fields use the exact bounds below. Account revision rows encode exactly `{namespace,accountId,revision}` and command action is exactly provision/link/unlink. Void settlement/release/reconciliation ports must return undefined, not an unvalidated receipt. Every port result and store read is an own, plain, exactly keyed record: reject nonplain prototypes, symbols, extra/missing fields, accessors, nonfinite numbers, unbounded strings/arrays and invalid nested fields **without invoking getters**. Copy validated values into detached snapshots before awaits and return. Store write results must be actual booleans; `false` aborts the transaction. `randomBytes(32)` must return exactly 32 bytes, encoded as bounded base64url IDs; collision refuses. Safe errors never include proof, token, consent secret, issuer/subject, account, SQL/provider text or another account's existence hint.

## Canonical route, uniqueness and operations

The exact identity key is `(namespace,issuer,subject)`, not email. One host-configured **canonical provider route per exact issuer** is admitted in this slice. If configured routes A and B both report one issuer, B is an alias and the host verifier wrapper must reject B **before** it invokes the frozen session core's four-field `resolveIdentity({issuer,subject,authTime,methods})`. The directory compares each stored providerId against `canonicalProviderForIssuer(issuer)` and current `providerState`; only mutation methods also receive and compare proof-input providerId. The unchanged four-field resolver cannot observe the incoming provider route. Unknown, disabled, noncanonical, absent or unlinked identities resolve `null`; no alternate route can silently mint an unusable session. A canonical-route change or alias migration requires separately qualified binding, not automatic relinking. An active session on the canonical route is usable only while the guard below passes.

`insertIdentity` enforces uniqueness of both `(namespace,issuer,subject)` and `(namespace,linkId)`. `updateIdentity` may change only status, generation and unlinkedAt; issuer, subject, providerId, accountId, linkId and linkedAt are immutable. Same-account relink may reactivate a tombstone at a new generation; another-account binding is denied by this facade. Account revision starts absent and is created at `1` with `putAccountRevision(accountId,null,1)`, then CAS-increments by one; overflow, stale generation/revision or ID collision rolls back. This facade's default-deny transfer scope is **not** a permanent prohibition on a later qualified recovery/transfer protocol covering consent, link history, session invalidation and replay fences.

`resolveIdentity` validates exactly the four verifier fields and canonical enabled route, reads only an active row and returns detached `{accountId}` or `null`. No email/display/phone/role match, first-login provisioning, outbox write or account creation occurs. The host wrapper's route rejection is mandatory separate integration acceptance DIR-I01; no directory-only test or mocked wrapper qualifies it. The directory-only checks concern the stored row and current canonical route, not an absent route argument.

`provision` verifies a fresh proof on its enabled canonical route and obtains explicit current trusted approval for the same identity and pre-existing account. It reserves funded growth, then atomically consumes approvalId, enforces uniqueness/limits and writes identity, revision, command receipt and one allowlisted `identity_provisioned` event. A matching command is idempotent after current scope checks; changed account/identity/digest conflicts. Host account creation and orphan repair stay outside this package.

`link` authenticates the session, calls `assertCurrentLink`, verifies a fresh current proof matching its exact active canonical identity and a fresh target proof on its enabled canonical route, then checks current application authority and target-bound consent. After growth reservation it rechecks session/guard/authority/provider/consent expiry immediately before the transaction. Within the transaction it validates actor generation, account revision, target uniqueness and consumed approval/consent/command keys, then writes link or same-account generation transition, revision, receipt and one `identity_linked` event. Exact command replay returns the saved result with `replay:true` after current scope checks without a new row/revision/event. A new command for an already-active target, another-account binding or changed intent conflicts. Concurrent accounts have at most one winner.

`unlink` requires the same current session/guard, fresh matching current proof, application authority and linkId-bound consent. It targets an opaque linkId from `list`, never a supplied account/email. At its final provider-policy check, **another** active link on an enabled canonical provider must remain; unknown state is unusable. It atomically writes a generation-incremented tombstone, revision, receipt and `identity_unlinked` event. A different-command repeat denies. Provider disablement after this check may race; the host disable workflow needs a separate last-method guard or recovery policy. An external recovery path cannot waive this facade's last-link rule.

`assertCurrentLink` is **mandatory at every protected session use, refresh and privileged dispatch boundary**, including before outbox event delivery. It authenticates the session, obtains trusted `SessionBinding`, checks current application authority for `guard`, current canonical enabled route and active row, and compares exact namespace/account/issuer/subject/provider/linkId/generation to `SessionProfile` and binding. Missing/stale sidecar denies. It returns a detached result, not a perpetual grant. Tokens from an unlinked generation fail before event delivery; a relinked same identity does not revive them. The host rechecks on each later protected boundary. An already-authorized in-flight action may finish if unlink/revocation occurs after its last check; no distributed atomic cancellation is promised. A separately proven same-boundary revocation fence could replace repeated checking only after equivalent acceptance.

`list` and `reconcile` require current session/guard and application authority. `list` returns only that account's bounded detached `{linkId,providerId,issuer,usable,linkedAt}` and revision, omitting subject/proof/token/email/role. Session-scoped reconcile reads only that account's command. Provision-scoped reconcile re-verifies fresh enabled canonical proof and **repeatable current provisioning approval**, derives account/approval from trusted ports rather than caller input, then reads only a matching command. Revoked approval denies; unknown command returns `null`, not confirmed abort. A found result has `replay:true`. The caller retains commandId/enrollmentRef and reconciles `commit_unknown` before another attempt; no provider resend is inferred.

## Funded footprint, lifecycle and uncertain commits

Exact input bounds: namespace 1–128 UTF-8 bytes; providerId 1–80 ASCII `[A-Za-z0-9_.-]`; issuer 1–2048 UTF-8 bytes; subject 1–512 UTF-8 bytes; accountId 1–512 characters per frozen session core; enrollmentRef, consent receipt and session token each ≤4096 UTF-8 bytes; commandId is the canonical time-bearing ASCII identifier defined below; proof ≤65536 bytes; methods 1–16 nonempty strings each ≤80 bytes. Auth time and `now()` are finite nonnegative integral milliseconds and not future; mutation proof age ≤maxFreshProofAgeMs. Positive safe-integer limits: proof age ≤900000 ms, links ≤32/account **including** tombstones, receipts ≤4096/account, pending events ≤4096/namespace, record bytes ≤16384, concurrent commands ≤64, replay window ≤2592000000 ms and total persisted logical rows ≤1000000/namespace (`maxRowsPerNamespace`, including acknowledged events, consumed approvals/consents and revision records). These are positive explicitly configured mechanical ceilings, not commercial quotas. No silent clamping. Persisted/result strings inherit these bounds; generated IDs are 32-byte random base64url; digest is SHA-256 as 64 lowercase hex; revisions/generations/timestamps are safe integers. Every logical identity, command, consent, event and revision record is canonically encoded as UTF-8 JSON with sorted keys and no whitespace, each ≤maxRecordBytes. Oversize or arithmetic overflow rejects before storage.

Before any mutation, `logicalFootprint` is exactly the ordered vector `[{kind:'identity',upperBytes:R},{kind:'accountRevision',upperBytes:R},{kind:'command',upperBytes:R},{kind:'consent',upperBytes:R},{kind:'event',upperBytes:R}]`, where `R=limits.maxRecordBytes`. It conservatively charges replacement rows as full rows, so its checked safe-integer logical bound is exactly `5*R`. Each actual sorted-key, whitespace-free UTF-8 JSON row must fit R; otherwise deny before quote/reservation. Do not estimate Unicode expansion, index bytes or backup ratios in this facade. Before committing, require `tx.countRows()+5 <= maxRowsPerNamespace` as a conservative namespace headroom check, plus account-link/receipt and pending-event limits. A qualified adapter must count all five row classes, including acknowledged events, and atomically serialize the count with inserts; count overflow/unknown denies. This may reject before the exact physical limit, deliberately preserving bounded behavior.

The trusted host `quoteGrowth` receives exactly this vector, command digest and replay deadline and establishes the physical index/replica/backup/restore cost and funded retention horizon. Its `Quote.upperLogicalBytes` must equal `5*R`, `footprintVersion` must be exactly `auth-directory.rows.v3`, quoteId is 1–128 ASCII `[A-Za-z0-9_.-]`, and admittedLifetimeUntil is a safe integral millisecond value at least replayUntil. Reserve requires that exact validated quote. A quote claiming less exposure or unknown finite physical/retention funding refuses; logical size alone never proves physical costs. The host economically admits and bounds retained identities, revisions, active session bindings and any restore metadata too; these ongoing allocations are not funded forever by a one-time replay-window quote. Host cost-quote/lifecycle evidence remains a mandatory production gate, not a synthetic oracle result.

The transaction writes identity/revision, receipt with `expiresAt`, consumed consent/approval and `pending` allowlisted outbox event together. Command digest binds namespace/account/action/canonical route/exact target identity or linkId/consent or approval ID/commandId, excluding raw proof/session/email. Events contain exactly the typed event fields, no subject. A **separate qualified host outbox worker** marks an event `acknowledged` transactionally only after a sink acknowledgement by stable eventId; duplicate delivery requires sink dedupe, and uncertain acknowledgement keeps it pending. Pending count falls only on durable acknowledgement. Only acknowledged events may later be compacted under qualified policy; dequeue is not deletion.

After **confirmed abort**, `releaseConfirmedAbort` idempotently releases held capacity. After committed transaction, `settle` idempotently finalizes it; a lost settle acknowledgement reconciles from exact committed receipt. On `commit_unknown`, this handle fences writes and retains reservation. A fresh qualified store must establish exact committed receipt/event or **confirmed abort** before `reconcileUnknown` settles/releases it; missing receipt alone is not abort proof. Repeated failed transactions cannot accumulate permanent holds when confirmed abort is available. Generic post-callback storage failure without rollback proof is `commit_unknown`; proved precommit/rollback failure is `storage_unavailable`. Capacity reservation failure creates no directory row/event. No money ledger or provider send is implemented here.

### Finite command horizon and qualified compaction

A command ID is exactly `<issuedAt>.<nonce>`: issuedAt is a canonical nonnegative safe-integer Unix-millisecond decimal with no leading zeros except `0`; nonce is exactly the 43-character unpadded base64url encoding of 32 random bytes. The trusted host issues it once using the qualified clock/randomness ports, retains it across retries, and binds it into approval/consent before invoking the directory. Syntax alone confers no authority. The directory parses it without storage, computes `deadline=issuedAt+replayWindowMs` with checked safe-integer arithmetic, and requires `issuedAt <= now < deadline`. Future IDs deny as invalid_input; expired IDs return command_expired before any storage/quote/reservation, including reconcile. There is no way to extend an old command's lifetime by replay or changing the current policy: replayWindowMs is immutable for a namespace; a changed window requires a separately qualified namespace migration. The caller must reconcile within the published retry horizon. It must not invent a new command when a prior result remains unknown.

Approval/consent must be cryptographically or equivalently host-authoritatively verified against that exact commandId, action/account/target and the exact issuedAt/deadline. Returned commandId/issuedAt/expiresAt must match those parsed values. Old receipt material cannot authorize a new time-bearing ID. ApprovalId/consentId are 1–128 ASCII `[A-Za-z0-9_.-]`, one-use while admitted, and stored with expiresAt=deadline. Stable result replay is available only before deadline and current authority checks; expiry ends replay even if a backup still contains the old receipt. There is **no permanent per-command replay-fence row**: expiry rejects an old key without a lookup. Fresh authorization is needed for a new command, so changing the timestamp cannot recycle old approval/consent.

A **separate qualified host lifecycle adapter** is mandatory before production. It may atomically remove an expired command receipt, its consumed approval/consent row and its acknowledged event only when now >= deadline, its capacity reservation is durably terminal, event acknowledgement is durable, no retry/reconciliation claim is still valid and primary/derived/backup/restore obligations are accounted for. Pending events and unknown reservations are quarantined within the same finite row/cost caps; neither expiry nor absence proves an abort or refunds storage. Their owner must reconcile them; unresolvable pressure denies new growth and is not a successful h24 service. Identity tombstones/account revisions and live session bindings retain their bounded per-account/namespace limits and funded continuing purpose, or need separately qualified recovery/transfer/retirement; no automatic identity transfer is introduced here.

The host must supply a current trusted clock that cannot roll backward across restart/restore. A backward or unknown time observation fences writes; a new handle or restored database cannot reset that check. Its independent time/restore fence is a mandatory host integration witness, not a promise from an in-memory maximum. The lifecycle adapter must publish finite backup/restore horizons and refuse restored mutation/event traffic until it has reconciled expiry, terminal reservations, durable sink dedupe and current links using that trusted time. A restored old receipt or approval cannot reopen an expired command. Physical backup copies keep their funded allocation until actually expired, and forward-time expiry does not assert immediate erasure.

The store contains only the five named logical row classes; its physical namespace/schema metadata is separately bounded and charged by the qualified adapter. At any time, stored logical rows <= configured maxRowsPerNamespace and logical bytes <= maxRowsPerNamespace*R (checked for safe overflow at construction); extra physical storage needs the host quote/adapter's measured bound. At most one command, consumed approval/consent and event is retained for each admitted command; active links/tombstones are separately capped. To demonstrate sustainable legitimate use, the real host must show ingestion and unresolved-event/commit rates within its configured retention and funded capacity, durable acknowledgement/compaction reclaiming resolved expired rows, and recovery headroom. The facade does not advertise unlimited commands, h24 proof or a commercial quota from these mechanical bounds.

The local mutation linearization point is durable directory commit after the last observable session/guard/authority/provider/consent checks. Revocation observed before that check denies. Revocation after it may race with an in-flight commit; later protected boundaries must check current link and grants. Neither asynchronous events nor this separate store cancel an already-authorized in-flight application action.

Closed safe error codes: `invalid_config | invalid_input | authentication_denied | authentication_unavailable | authorization_denied | provider_disabled | consent_denied | identity_conflict | command_conflict | command_expired | last_method | capacity_exceeded | storage_unavailable | commit_unknown`. Unknown funding, unqualified lifecycle, overflow, full durable outbox and malformed port returns fail closed. The 44 descriptions in [directory-core-cases-v1.json](directory-core-cases-v1.json) bind the adjacent executable oracle. Verifier wrapper, session-binding sidecar, current-link host integration, persistent unique indexes/transaction, cost quote and lifecycle adapters, proof protocols, Nest/HTTP integration, source A/B/C, independent GS and runtime checks remain mandatory.

## Clause-to-case map

| Clause | Design obligation | Cases |
| --- | --- | --- |
| DIR-C01 | Closed factory and bounded validated inputs | DIR-T01–T02 |
| DIR-C02 | Exact identity and canonical route resolution | DIR-T03–T06, T29–T30 |
| DIR-C03 | Explicit provision to an existing account | DIR-T07–T09, T35 |
| DIR-C04 | Current session and fresh proof | DIR-T10–T12 |
| DIR-C05 | Bound one-use consent | DIR-T13 |
| DIR-C06 | Atomic uniqueness, generation, revision and replay | DIR-T14–T17, T33, T40 |
| DIR-C07 | Unlink tombstone and last method | DIR-T18–T19 |
| DIR-C08 | Provider disablement and alias denial | DIR-T05, T20, T29–T30 |
| DIR-C09 | Scoped list/reconcile and detached exact records | DIR-T21–T22, T24, T34–T35 |
| DIR-C10 | Durable state, receipt, expiring consent and acknowledged outbox | DIR-T08, T13–T14, T23–T24, T37–T40 |
| DIR-C11 | Mandatory current-link boundary and honest race | DIR-T10, T25–T26, T31–T32 |
| DIR-C12 | Funded quote, capacity, retention and uncertainty | DIR-T27–T28, T36–T40 |

DIR-T41–T44 additionally cover finite command expiry, exact receipt binding, namespace row/byte bounds and expired resolved compaction/restore fencing under DIR-C01/C05/C10/C12. DIR-I01 (real host verifier alias rejection before resolver) , DIR-I02 (real session issuance/binding/refresh/guard and trusted-time restore integration) and DIR-I03 (real persistent COMMIT/rollback outcome and sink acknowledgement/dedupe with crash/restore) are mandatory **host integration** requirements, excluded from the directory oracle execution count. The case IDs above abbreviate repeated `DIR-` prefixes within ranges. DIR-T38/T39 use only injected authoritative outcomes/fixture state to exercise directory hold and admission transitions; they cannot qualify a real database outcome, sink acknowledgement or restore. The local default candidate is intentionally unimplemented and does not pass these cases.

Primary references: [OpenID Connect Core §5.7](https://www.openid.net/specs/openid-connect-core-1_0.html#ClaimStability) for issuer/subject identity and [NIST SP 800-63B-4 authenticator events](https://pages.nist.gov/800-63-4/sp800-63b/events/) for binding/recovery context. The concrete limits and lifecycle choices above are proposed module design, not requirements copied from those standards.
