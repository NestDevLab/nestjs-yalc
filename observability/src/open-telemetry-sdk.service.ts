import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OBSERVABILITY_OPTIONS } from './tokens.js';
import type { NormalizedObservabilityOptions } from './observability-options.js';
import type { Attributes } from '@opentelemetry/api';

@Injectable()
export class OpenTelemetrySdkService implements OnModuleDestroy {
  private sdk?: NodeSDK;

  constructor(
    @Inject(OBSERVABILITY_OPTIONS)
    private readonly options: NormalizedObservabilityOptions,
  ) {
    this.start();
  }

  async onModuleDestroy() {
    if (!this.sdk) {
      return;
    }

    await this.execute(() => this.sdk?.shutdown());
    logs.disable();
    this.sdk = undefined;
  }

  exportLogRecord(name: string, attributes: Attributes, severityText = 'info') {
    if (!this.options.enabled) {
      return;
    }

    void this.executeAsync(async () => {
      await fetch(`${this.options.otlpEndpoint}/v1/logs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          resourceLogs: [
            {
              resource: {
                attributes: [
                  {
                    key: 'service.name',
                    value: { stringValue: this.options.serviceName },
                  },
                ],
              },
              scopeLogs: [
                {
                  scope: {
                    name: '@nestjs-yalc/observability',
                  },
                  logRecords: [
                    {
                      timeUnixNano: `${BigInt(Date.now()) * 1000000n}`,
                      severityText,
                      body: { stringValue: name },
                      attributes: toOtlpAttributes(attributes),
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });
    });
  }

  private start() {
    if (!this.options.enabled) {
      return;
    }

    const endpoint = this.options.otlpEndpoint;
    this.sdk = new NodeSDK({
      serviceName: this.options.serviceName,
      traceExporter: new OTLPTraceExporter({
        url: `${endpoint}/v1/traces`,
      }),
      metricReaders: [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            url: `${endpoint}/v1/metrics`,
          }),
          exportIntervalMillis: this.options.metricExportIntervalMillis,
        }),
      ],
      logRecordProcessors: [
        new SimpleLogRecordProcessor(
          new OTLPLogExporter({
            url: `${endpoint}/v1/logs`,
          }),
        ),
      ],
    });

    this.execute(() => this.sdk?.start());
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

  private async executeAsync(operation: () => Promise<void>) {
    try {
      await operation();
    } catch (error) {
      if (this.options.failureMode === 'throw') {
        throw error;
      }
    }
  }
}

function toOtlpAttributes(attributes: Attributes) {
  return Object.entries(attributes).map(([key, value]) => ({
    key,
    value: toOtlpAnyValue(value),
  }));
}

function toOtlpAnyValue(value: unknown) {
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { intValue: String(value) }
      : { doubleValue: value };
  }

  if (typeof value === 'boolean') {
    return { boolValue: value };
  }

  return { stringValue: String(value) };
}
