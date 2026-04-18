import { Inject, Injectable } from '@nestjs/common';
import {
  SpanStatusCode,
  context,
  metrics,
  trace,
  type Attributes,
  type Span,
} from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import type { IEventPayload } from '@nestjs-yalc/event-manager/event.js';
import { OBSERVABILITY_OPTIONS } from './tokens.js';
import type { NormalizedObservabilityOptions } from './observability-options.js';
import { OpenTelemetrySdkService } from './open-telemetry-sdk.service.js';

export interface TelemetryRecordOptions {
  attributes?: Record<string, unknown>;
}

@Injectable()
export class TelemetryService {
  private readonly tracer = trace.getTracer('@nestjs-yalc/observability');
  private readonly meter = metrics.getMeter('@nestjs-yalc/observability');
  private readonly logger = logs.getLogger('@nestjs-yalc/observability');
  private readonly eventCounter = this.meter.createCounter('yalc_events_total');
  private readonly errorCounter = this.meter.createCounter(
    'yalc_event_errors_total',
  );
  private readonly durationHistogram = this.meter.createHistogram(
    'yalc_operation_duration_ms',
  );

  constructor(
    @Inject(OBSERVABILITY_OPTIONS)
    private readonly options: NormalizedObservabilityOptions,
    private readonly sdk: OpenTelemetrySdkService,
  ) {}

  get enabled() {
    return this.options.enabled;
  }

  measure<T>(
    name: string,
    operation: () => T | Promise<T>,
    attributes: Record<string, unknown> = {},
  ): T | Promise<T> {
    if (!this.enabled) {
      return operation();
    }

    const normalizedAttributes = toTelemetryAttributes(attributes);
    const startedAt = Date.now();

    return this.execute(() =>
      this.tracer.startActiveSpan(
        name,
        { attributes: normalizedAttributes },
        (span) =>
          this.measureWithSpan(
            name,
            operation,
            normalizedAttributes,
            startedAt,
            span,
          ),
      ),
    ) as T | Promise<T>;
  }

  recordYalcEvent(eventName: string, payload?: IEventPayload) {
    if (!this.enabled) {
      return;
    }

    this.execute(() => {
      const attributes = this.buildEventAttributes(eventName, payload);
      const activeSpan = trace.getActiveSpan();
      activeSpan?.addEvent(eventName, attributes);

      if (payload?.errorInfo) {
        activeSpan?.recordException(
          payload.errorInfo as unknown as Error | string,
        );
        activeSpan?.setStatus({
          code: SpanStatusCode.ERROR,
          message: getErrorMessage(payload.errorInfo),
        });
        this.errorCounter.add(1, attributes);
      }

      this.eventCounter.add(1, attributes);
      this.sdk.exportLogRecord(eventName, attributes, payload?.level ?? 'info');
      this.logger.emit({
        eventName,
        severityText: payload?.level ?? 'info',
        severityNumber: toSeverityNumber(payload?.level),
        body: payload?.message ?? eventName,
        attributes,
        context: context.active(),
        exception: payload?.errorInfo,
      });
    });
  }

  recordDuration(
    name: string,
    durationMs: number,
    attributes: Record<string, unknown> = {},
  ) {
    if (!this.enabled) {
      return;
    }

    this.execute(() => {
      this.durationHistogram.record(durationMs, {
        'yalc.operation.name': name,
        ...toTelemetryAttributes(attributes),
      });
      this.sdk.exportLogRecord(
        name,
        {
          'yalc.telemetry.kind': 'duration',
          'yalc.operation.name': name,
          'yalc.operation.duration_ms': durationMs,
          ...toTelemetryAttributes(attributes),
        },
        'info',
      );
    });
  }

  private measureWithSpan<T>(
    name: string,
    operation: () => T | Promise<T>,
    attributes: Attributes,
    startedAt: number,
    span: Span,
  ): T | Promise<T> {
    try {
      const result = operation();

      if (isPromiseLike(result)) {
        return result.then(
          (value) => {
            this.finishSpan(name, startedAt, attributes, span);
            return value;
          },
          (error: unknown) => {
            this.failSpan(name, startedAt, attributes, span, error);
            throw error;
          },
        );
      }

      this.finishSpan(name, startedAt, attributes, span);
      return result;
    } catch (error) {
      this.failSpan(name, startedAt, attributes, span, error);
      throw error;
    }
  }

  private finishSpan(
    name: string,
    startedAt: number,
    attributes: Attributes,
    span: Span,
  ) {
    this.recordDuration(name, Date.now() - startedAt, attributes);
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  }

  private failSpan(
    name: string,
    startedAt: number,
    attributes: Attributes,
    span: Span,
    error: unknown,
  ) {
    this.recordDuration(name, Date.now() - startedAt, {
      ...attributes,
      'yalc.operation.error': true,
    });
    span.recordException(normalizeError(error));
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
    span.end();
  }

  private buildEventAttributes(eventName: string, payload?: IEventPayload) {
    const attributes: Record<string, unknown> = {
      'yalc.event.name': eventName,
      'yalc.event.payload_name': payload?.eventName,
      'yalc.event.level': payload?.level,
      'yalc.event.has_error': Boolean(payload?.errorInfo),
    };

    if (payload?.errorInfo) {
      attributes['yalc.error.name'] = payload.errorInfo.errorName;
      attributes['yalc.error.message'] = getErrorMessage(payload.errorInfo);
      attributes['yalc.error.code'] = (
        payload.errorInfo as Record<string, unknown>
      ).errorCode;
    }

    if (this.options.payload.include && payload?.data) {
      attributes['yalc.event.payload'] = safeJsonStringify(
        maskObject(payload.data, this.options.payload.mask),
        this.options.payload.maxSize,
      );
    }

    return toTelemetryAttributes(attributes);
  }

  private execute<T>(operation: () => T): T | undefined {
    try {
      return operation();
    } catch (error) {
      if (this.options.failureMode === 'throw') {
        throw error;
      }

      return undefined;
    }
  }
}

export function toTelemetryAttributes(
  attributes: Record<string, unknown> = {},
): Attributes {
  return Object.fromEntries(
    Object.entries(attributes)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, toTelemetryAttributeValue(value)]),
  );
}

function toTelemetryAttributeValue(value: unknown) {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return safeJsonStringify(value, 4096);
  }

  return safeJsonStringify(value, 4096);
}

function safeJsonStringify(value: unknown, maxSize: number) {
  let output: string;

  try {
    output = JSON.stringify(value);
  } catch {
    output = String(value);
  }

  return output.length > maxSize ? output.slice(0, maxSize) : output;
}

function maskObject(value: unknown, mask: string[]): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskObject(item, mask));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      mask.some((maskKey) => key.toLowerCase().includes(maskKey.toLowerCase()))
        ? '[masked]'
        : maskObject(item, mask),
    ]),
  );
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof (value as Promise<T>).then === 'function'
  );
}

function toSeverityNumber(level?: string): SeverityNumber {
  if (level === 'error') return SeverityNumber.ERROR;
  if (level === 'warn') return SeverityNumber.WARN;
  if (level === 'debug') return SeverityNumber.DEBUG;
  if (level === 'verbose') return SeverityNumber.TRACE;

  return SeverityNumber.INFO;
}

function getErrorMessage(errorInfo: {
  message?: string;
  internalMessage?: string;
}) {
  return errorInfo.message ?? errorInfo.internalMessage;
}
