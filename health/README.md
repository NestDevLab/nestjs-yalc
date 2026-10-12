# @nestjs-yalc/health

`@nestjs-yalc/health` supplies read-only probe primitives and an incident state machine for NestJS monitors. Applications own the check registry, credentials, API, storage location, alert transport, and any environment-specific probes.

## Checks

`runGenericProbe` accepts a `CheckDefinition` and supports GET-only HTTP, strict streamable HTTP MCP, TCP connect, file metadata, JSON heartbeat files, and a single SQLite `SELECT` opened with `OPEN_READONLY`. It never stores response bodies. All results have a hard deadline; callers should use `ProbeScheduler` to limit concurrency and spread checks with jitter. MCP request methods require an answer on the POST; a `202 Accepted` response is reported as a protocol defect, not treated as success.

`redactHealthText` removes bearer tokens, JWTs, URL token parameters, header values, and long opaque values before truncating summaries. Call it again at persistence and notification boundaries.

## State and storage

`transitionCheck` is a pure function. A check opens after two failures and recovers after two successes by default. Dependencies may put a child into `blocked`; startup and pid-change grace periods keep it `unknown`. Four status transitions in one hour mark flapping, which clears after 30 minutes of stability. Persist the returned state before deriving alerts.

`healthEntities` supplies TypeORM models for definitions, results, state, incidents, silences, outbox and heartbeats. `HealthMonitorService` records transitions and stores redacted summaries. `OutboxNotifier` implements the `Notifier` interface with a unique deduplication key. It queues alerts; an application-specific relay is responsible for delivery. The package does not send messages or mutate monitored services.

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
