# @nestjs-yalc/observability

OpenTelemetry integration for YALC applications.

The package adds opt-in telemetry around EventManager events and selected call
or event strategies. It can export logs, metrics, span events, and exceptions
through OTLP while keeping `YalcEventService` as the source of structured
application events.

## Installation

```bash
npm install @nestjs-yalc/observability
```

Install and run an OpenTelemetry-compatible backend, such as an OTLP collector
or Grafana LGTM stack, when you want exported telemetry.

## Module

```ts
import {
  ObservabilityModule,
  createObservabilityOptionsFromEnv,
} from '@nestjs-yalc/observability';

@Module({
  imports: [
    ObservabilityModule.forRoot(() =>
      createObservabilityOptionsFromEnv('task-system-app'),
    ),
  ],
})
export class AppModule {}
```

## Runtime Helpers

- `TelemetryService.measure` records workflow duration.
- `TelemetryCallStrategy` observes an existing call strategy without changing
  the caller contract.
- `TelemetryEventStrategy` observes an existing event strategy.
- `OpenTelemetryEventManagerPlugin` subscribes to EventManager events.

## Environment

- `YALC_OBSERVABILITY_ENABLED=true` enables the plugin.
- `YALC_OTEL_SERVICE_NAME` overrides the OpenTelemetry service name.
- `YALC_OTEL_ENDPOINT` defaults to `http://127.0.0.1:4318`.
- `YALC_OBSERVABILITY_EVENT_LISTEN_TO` defaults to `**`.
- `YALC_OBSERVABILITY_EVENT_IGNORE` defaults to `observability.**`.
- `YALC_OBSERVABILITY_INCLUDE_EVENT_PAYLOAD=true` exports masked event payloads.
- `YALC_OBSERVABILITY_FAILURE_MODE=throw` makes telemetry failures visible.

Payloads are not exported by default. When enabled, payloads are JSON encoded,
truncated, and masked for common secret keys.

## Documentation

- Observability guide:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/observability.md
- Task app observability example:
  https://github.com/NestDevLab/nestjs-yalc/blob/dev/examples/task/app/README.md
