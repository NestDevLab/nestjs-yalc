import type { TelemetryService } from '../telemetry.service.js';

export function Observed(name?: string): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    const operationName =
      name ?? `${target.constructor.name}.${String(propertyKey)}`;

    descriptor.value = function (...args: unknown[]) {
      const telemetry = resolveTelemetryService(this);

      if (!telemetry) {
        return original.apply(this, args);
      }

      return telemetry.measure(operationName, () => original.apply(this, args));
    };

    return descriptor;
  };
}

function resolveTelemetryService(
  instance: unknown,
): TelemetryService | undefined {
  const source = instance as {
    telemetry?: TelemetryService;
    telemetryService?: TelemetryService;
  };

  return source.telemetry ?? source.telemetryService;
}
