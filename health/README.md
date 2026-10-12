# @nestjs-yalc/health

`@nestjs-yalc/health` supplies read-only probe primitives and an incident state machine for NestJS monitors. Applications own the check registry, credentials, API, storage location, alert transport, and any environment-specific probes.

## Checks

`runGenericProbe` accepts a `CheckDefinition` and supports GET-only HTTP, strict streamable HTTP MCP, TCP connect, file metadata, JSON heartbeat files, and a single SQLite `SELECT` opened with `OPEN_READONLY`. It never stores response bodies. All results have a hard deadline; callers should use `ProbeScheduler` to limit concurrency and spread checks with jitter. MCP initialization requires a session ID; each JSON-RPC response must have version `2.0` and the matching request ID. MCP request methods require an answer on the POST; a `202 Accepted` response is reported as a protocol defect, not treated as success.

Authenticated HTTP and MCP probes take a `credentialRef` name on the check definition and a `CredentialResolver` argument to `runGenericProbe`. The resolver supplies an in-memory `authorization` or `x-api-key` header. Never put credentials in `target`: persistence rejects credential fields and token-bearing URLs. A missing resolver leaves the check `unknown`; failures use safe summaries without exception text. A SQLite freshness check may set `target.numericField` and `target.maxAgeMs`; the selected field must be a numeric Unix millisecond timestamp. An older value returns `stale`, while a missing or nonnumeric field is a protocol failure.

`redactHealthText` removes bearer tokens, JWTs, URL token parameters, header values, and long opaque values before truncating summaries. Call it again at persistence and notification boundaries.

## State and storage

`transitionCheck` is a pure function. A check opens after two failures and recovers after two successes by default. Dependencies may put a child into `blocked`; startup and pid-change grace periods keep it `unknown`. Four status transitions in one hour mark flapping, which clears after 30 minutes of stability. A recovery on the fourth transition reports both `recoveredIncidentId` and the flapping event.

`healthEntities` supplies TypeORM models for definitions, results, state, incidents, silences, outbox and heartbeats. `HealthMonitorService` stores the transition, result, incident and outbox row in one database transaction. `stableSince` is persisted so flapping clears after a monitor restart. `OutboxNotifier` implements the `Notifier` interface with a unique deduplication key and uses the transaction manager passed by the monitor. Custom notifiers must queue to the same transaction; delivery happens after commit in an application-specific relay. The package does not send messages or mutate monitored services.

The `service-report` probe intentionally returns `unknown` until the service-side `HealthReportModule` and `JobRunTracker` arrive in the later service-report batch.

```ts
import {
  runGenericProbe,
  transitionCheck,
  initialCheckState,
} from "@nestjs-yalc/health";

const check = {
  key: "sample.http",
  group: "sample",
  title: "Sample API",
  kind: "http",
  target: { url: "https://example.invalid/health", status: 200 },
  intervalSeconds: 60,
  timeoutMs: 1000,
  severity: "warning",
} as const;
const result = await runGenericProbe(check);
const next = transitionCheck({
  state: initialCheckState(Date.now()),
  result,
  now: Date.now(),
});
```
