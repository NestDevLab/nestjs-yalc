import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import {
  type ObservabilityOptions,
  normalizeObservabilityOptions,
} from './observability-options.js';
import { OBSERVABILITY_OPTIONS } from './tokens.js';
import { OpenTelemetrySdkService } from './open-telemetry-sdk.service.js';
import { TelemetryService } from './telemetry.service.js';
import { OpenTelemetryEventManagerPlugin } from './event-manager/opentelemetry-event-manager.plugin.js';

@Global()
@Module({})
export class ObservabilityModule {
  static forRoot(
    options: ObservabilityOptions | (() => ObservabilityOptions),
  ): DynamicModule {
    const providers: Provider[] = [
      {
        provide: OBSERVABILITY_OPTIONS,
        useFactory: () =>
          normalizeObservabilityOptions(
            typeof options === 'function' ? options() : options,
          ),
      },
      OpenTelemetrySdkService,
      TelemetryService,
      OpenTelemetryEventManagerPlugin,
    ];

    return {
      module: ObservabilityModule,
      providers,
      exports: [OBSERVABILITY_OPTIONS, TelemetryService],
    };
  }
}

@Module({})
export class OpenTelemetryEventManagerPluginModule {
  static forRoot(
    options: ObservabilityOptions | (() => ObservabilityOptions),
  ): DynamicModule {
    return ObservabilityModule.forRoot(options);
  }
}
