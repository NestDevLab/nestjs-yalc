import { ObservabilityModule } from "../observability.module.js";
import { OBSERVABILITY_OPTIONS } from "../tokens.js";
import { TelemetryService } from "../telemetry.service.js";
import { jest } from "@jest/globals";

describe("ObservabilityModule", () => {
  it("registers normalized observability options from an object", () => {
    const module = ObservabilityModule.forRoot({
      enabled: false,
      serviceName: "unit-test",
    });

    expect(module.module).toBe(ObservabilityModule);
    expect(module.exports).toContain(OBSERVABILITY_OPTIONS);
    expect(module.exports).toContain(TelemetryService);

    const optionsProvider = module.providers?.find(
      (provider) =>
        typeof provider === "object" &&
        "provide" in provider &&
        provider.provide === OBSERVABILITY_OPTIONS
    ) as { useFactory: () => unknown };

    expect(optionsProvider.useFactory()).toMatchObject({
      enabled: false,
      serviceName: "unit-test",
      otlpEndpoint: "http://127.0.0.1:4318",
    });
  });

  it("evaluates option factories lazily", () => {
    const factory = jest.fn(() => ({
      enabled: true,
      serviceName: "lazy-service",
      otlpEndpoint: "http://collector:4318/",
    }));
    const module = ObservabilityModule.forRoot(factory);
    const optionsProvider = module.providers?.find(
      (provider) =>
        typeof provider === "object" &&
        "provide" in provider &&
        provider.provide === OBSERVABILITY_OPTIONS
    ) as { useFactory: () => unknown };

    expect(factory).not.toHaveBeenCalled();
    expect(optionsProvider.useFactory()).toMatchObject({
      enabled: true,
      serviceName: "lazy-service",
      otlpEndpoint: "http://collector:4318",
    });
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
