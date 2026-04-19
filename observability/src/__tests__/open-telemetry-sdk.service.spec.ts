import { OpenTelemetrySdkService } from "../open-telemetry-sdk.service.js";
import { normalizeObservabilityOptions } from "../observability-options.js";
import { jest } from "@jest/globals";

describe("OpenTelemetrySdkService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not start when disabled", async () => {
    const service = new OpenTelemetrySdkService(
      normalizeObservabilityOptions({
        enabled: false,
        serviceName: "disabled",
      })
    );

    await service.onModuleDestroy();
  });

  it("starts and shuts down the OpenTelemetry SDK when enabled", async () => {
    const service = new OpenTelemetrySdkService(
      normalizeObservabilityOptions({
        enabled: true,
        serviceName: "sdk-test",
        otlpEndpoint: "http://collector:4318/",
      })
    );

    await service.onModuleDestroy();
  });
});
