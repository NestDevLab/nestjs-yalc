import { OpenTelemetrySdkService } from "../open-telemetry-sdk.service.js";
import { normalizeObservabilityOptions } from "../observability-options.js";
import { jest } from "@jest/globals";

describe("OpenTelemetrySdkService", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("does not start or export when disabled", async () => {
    const fetch = jest.fn();
    globalThis.fetch = fetch as typeof globalThis.fetch;
    const service = new OpenTelemetrySdkService(
      normalizeObservabilityOptions({
        enabled: false,
        serviceName: "disabled",
      })
    );

    service.exportLogRecord("test.disabled", { ok: true });
    await service.onModuleDestroy();

    expect(fetch).not.toHaveBeenCalled();
  });

  it("exports log records through the OTLP HTTP endpoint", async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetch as typeof globalThis.fetch;
    const service = new OpenTelemetrySdkService(
      normalizeObservabilityOptions({
        enabled: true,
        serviceName: "sdk-test",
        otlpEndpoint: "http://collector:4318/",
      })
    );

    service.exportLogRecord(
      "test.record",
      {
        text: "value",
        count: 2,
        ratio: 1.5,
        ok: true,
      },
      "warn"
    );

    await new Promise((resolve) => setImmediate(resolve));
    await service.onModuleDestroy();

    expect(fetch).toHaveBeenCalledWith(
      "http://collector:4318/v1/logs",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: expect.stringContaining("test.record"),
      })
    );

    const body = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(body.resourceLogs[0].resource.attributes).toContainEqual({
      key: "service.name",
      value: { stringValue: "sdk-test" },
    });
    expect(body.resourceLogs[0].scopeLogs[0].logRecords[0]).toMatchObject({
      severityText: "warn",
      body: { stringValue: "test.record" },
    });
  });

  it("ignores export failures by default", async () => {
    const fetch = jest.fn().mockRejectedValue(new Error("collector down"));
    globalThis.fetch = fetch as typeof globalThis.fetch;
    const service = new OpenTelemetrySdkService(
      normalizeObservabilityOptions({
        enabled: true,
        serviceName: "sdk-test",
      })
    );

    expect(() => service.exportLogRecord("test.failure", {})).not.toThrow();

    await new Promise((resolve) => setImmediate(resolve));
    await service.onModuleDestroy();
  });
});
