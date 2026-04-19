export type ObservabilityFailureMode = 'ignore' | 'throw';

export interface ObservabilityEventManagerOptions {
  enabled?: boolean;
  listenTo?: string[];
  ignore?: string[];
}

export interface ObservabilityPayloadOptions {
  include?: boolean;
  maxSize?: number;
  mask?: string[];
}

export interface ObservabilityOptions {
  enabled?: boolean;
  serviceName: string;
  otlpEndpoint?: string;
  eventManager?: ObservabilityEventManagerOptions;
  payload?: ObservabilityPayloadOptions;
  failureMode?: ObservabilityFailureMode;
  metricExportIntervalMillis?: number;
}

export interface NormalizedObservabilityOptions {
  enabled: boolean;
  serviceName: string;
  otlpEndpoint: string;
  eventManager: Required<ObservabilityEventManagerOptions>;
  payload: Required<ObservabilityPayloadOptions>;
  failureMode: ObservabilityFailureMode;
  metricExportIntervalMillis: number;
}

export function normalizeObservabilityOptions(
  options: ObservabilityOptions,
): NormalizedObservabilityOptions {
  return {
    enabled: options.enabled ?? false,
    serviceName: options.serviceName,
    otlpEndpoint: trimTrailingSlash(
      options.otlpEndpoint ?? 'http://127.0.0.1:4318',
    ),
    eventManager: {
      enabled: options.eventManager?.enabled ?? true,
      listenTo: options.eventManager?.listenTo ?? ['**'],
      ignore: options.eventManager?.ignore ?? ['observability.**'],
    },
    payload: {
      include: options.payload?.include ?? false,
      maxSize: options.payload?.maxSize ?? 4096,
      mask: options.payload?.mask ?? [
        'authorization',
        'password',
        'secret',
        'token',
      ],
    },
    failureMode: options.failureMode ?? 'ignore',
    metricExportIntervalMillis: options.metricExportIntervalMillis ?? 500,
  };
}

export function createObservabilityOptionsFromEnv(
  serviceName: string,
): ObservabilityOptions {
  return {
    enabled: process.env.YALC_OBSERVABILITY_ENABLED === 'true',
    serviceName: process.env.YALC_OTEL_SERVICE_NAME?.trim() || serviceName,
    otlpEndpoint: process.env.YALC_OTEL_ENDPOINT?.trim(),
    eventManager: {
      enabled: process.env.YALC_OBSERVABILITY_EVENT_MANAGER_ENABLED !== 'false',
      listenTo: splitCsv(process.env.YALC_OBSERVABILITY_EVENT_LISTEN_TO),
      ignore: splitCsv(process.env.YALC_OBSERVABILITY_EVENT_IGNORE),
    },
    payload: {
      include: process.env.YALC_OBSERVABILITY_INCLUDE_EVENT_PAYLOAD === 'true',
      mask: splitCsv(process.env.YALC_OBSERVABILITY_PAYLOAD_MASK),
    },
    failureMode:
      process.env.YALC_OBSERVABILITY_FAILURE_MODE === 'throw'
        ? 'throw'
        : 'ignore',
  };
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function splitCsv(value?: string) {
  const items = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return items && items.length > 0 ? items : undefined;
}
