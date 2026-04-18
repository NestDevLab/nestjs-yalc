# Observability

`@nestjs-yalc/observability` adds opt-in telemetry around YALC applications.
The first implementation is an OpenTelemetry plugin for EventManager: it
listens to `EventEmitter2` events produced by `YalcEventService` and exports
logs, metrics, span events, and exceptions through OTLP.

The package does not replace `event-manager`. `YalcEventService` remains the
source of structured application events; observability is an external plugin
that subscribes to those events.

## Module

```ts
import {
  ObservabilityModule,
  createObservabilityOptionsFromEnv,
} from "@nestjs-yalc/observability";

@Module({
  imports: [
    ObservabilityModule.forRoot(() =>
      createObservabilityOptionsFromEnv("task-system-app")
    ),
  ],
})
export class AppModule {}
```

Environment configuration:

- `YALC_OBSERVABILITY_ENABLED=true` enables the plugin.
- `YALC_OTEL_SERVICE_NAME` overrides the OpenTelemetry service name.
- `YALC_OTEL_ENDPOINT` defaults to `http://127.0.0.1:4318`.
- `YALC_OBSERVABILITY_EVENT_LISTEN_TO` defaults to `**`.
- `YALC_OBSERVABILITY_EVENT_IGNORE` defaults to `observability.**`.
- `YALC_OBSERVABILITY_INCLUDE_EVENT_PAYLOAD=true` exports masked event payloads.
- `YALC_OBSERVABILITY_FAILURE_MODE=throw` makes telemetry failures visible;
  the default `ignore` keeps the app running if the backend is unavailable.

Payloads are not exported by default. When enabled, payloads are JSON encoded,
truncated, and masked for common secret keys.

## Runtime Helpers

Use `TelemetryService.measure` when a workflow or strategy needs duration data:

```ts
return this.telemetry.measure('task-workflows.complete-task', async () => {
  await this.client.updateTask(taskId, { status: 'done' });
  return this.client.getTask(taskId);
});
```

Use `TelemetryCallStrategy` and `TelemetryEventStrategy` to observe existing
strategy instances without changing their caller contract.

## Local Grafana

Grafana is not an npm dependency. Example apps can run it as a local Docker
Compose stack through Grafana LGTM:

```bash
npm run observability:up --prefix examples/task/app
```

If port `3000` is already used, expose Grafana on a different host port:

```bash
GRAFANA_PORT=3002 npm run observability:up --prefix examples/task/app
```

The stack exposes:

- Grafana UI on `http://127.0.0.1:3000` by default
- OTLP HTTP on `http://127.0.0.1:4318`
- OTLP gRPC on `127.0.0.1:4317`

CI uses only an OpenTelemetry Collector with a file/debug exporter because a
full Grafana UI is unnecessary for automated verification.
