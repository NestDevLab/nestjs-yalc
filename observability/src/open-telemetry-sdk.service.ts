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
}
