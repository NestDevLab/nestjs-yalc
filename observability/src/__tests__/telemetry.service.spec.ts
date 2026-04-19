import {
  TelemetryService,
  toTelemetryAttributes,
} from "../telemetry.service.js";
import { normalizeObservabilityOptions } from "../observability-options.js";
import { jest } from "@jest/globals";
import { logs } from "@opentelemetry/api-logs";
import { trace } from "@opentelemetry/api";

describe("TelemetryService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("runs operations without telemetry when disabled", async () => {
    const service = new TelemetryService(
      normalizeObservabilityOptions({
        enabled: false,
        serviceName: "test",
      })
    );

    await expect(
      service.measure("test.operation", async () => "ok")
    ).resolves.toBe("ok");
  });

  it("records failed operations", async () => {
    const service = new TelemetryService(
      normalizeObservabilityOptions({
        enabled: true,
        serviceName: "test",
      })
    );

    await expect(
      service.measure("test.failure", async () => {
        throw new Error("failed");
      })
    ).rejects.toThrow("failed");
  });

  it("records event payloads with masked data", () => {
    const emit = jest.fn();
    jest.spyOn(logs, "getLogger").mockReturnValue({ emit } as any);
    const service = new TelemetryService(
      normalizeObservabilityOptions({
        enabled: true,
        serviceName: "test",
        payload: {
          include: true,
          mask: ["token"],
        },
      })
    );

    service.recordYalcEvent("task.created", {
      eventName: "task.created",
      level: "warn",
      message: "Task created",
      data: {
        token: "secret",
        nested: {
          accessToken: "secret",
          visible: "ok",
        },
      },
    } as any);

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "task.created",
        severityText: "warn",
        attributes: expect.objectContaining({
          "yalc.event.name": "task.created",
          "yalc.event.level": "warn",
          "yalc.event.payload":
            '{"token":"[masked]","nested":{"accessToken":"[masked]","visible":"ok"}}',
        }),
      })
    );
  });

  it("records event errors as telemetry attributes", () => {
    const emit = jest.fn();
    jest.spyOn(logs, "getLogger").mockReturnValue({ emit } as any);
    const service = new TelemetryService(
      normalizeObservabilityOptions({
        enabled: true,
        serviceName: "test",
      })
    );

    service.recordYalcEvent("task.failed", {
      eventName: "task.failed",
      level: "error",
      message: "Task failed",
      errorInfo: {
        errorName: "TaskError",
        message: "Task failed",
        errorCode: "TASK_FAILED",
      },
    } as any);

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "task.failed",
        severityText: "error",
        attributes: expect.objectContaining({
          "yalc.event.has_error": true,
          "yalc.error.name": "TaskError",
          "yalc.error.message": "Task failed",
          "yalc.error.code": "TASK_FAILED",
        }),
      })
    );
  });

  it("respects throw failure mode for telemetry backend failures", () => {
    const emit = jest.fn(() => {
      throw new Error("telemetry failed");
    });
    jest.spyOn(logs, "getLogger").mockReturnValue({ emit } as any);
    const service = new TelemetryService(
      normalizeObservabilityOptions({
        enabled: true,
        serviceName: "test",
        failureMode: "throw",
      })
    );

    expect(() =>
      service.recordYalcEvent("task.created", {
        eventName: "task.created",
      } as any)
    ).toThrow("telemetry failed");
  });

  it("runs the wrapped operation when span setup fails in ignore mode", async () => {
    jest.spyOn(trace, "getTracer").mockReturnValue({
      startActiveSpan: () => {
        throw new Error("span setup failed");
      },
    } as any);
    const service = new TelemetryService(
      normalizeObservabilityOptions({
        enabled: true,
        serviceName: "test",
      })
    );

    await expect(
      service.measure("test.operation", async () => "ok")
    ).resolves.toBe("ok");
  });

  it("normalizes complex attributes", () => {
    expect(
      toTelemetryAttributes({
        string: "value",
        number: 1,
        boolean: true,
        object: { ok: true },
        array: ["a", 1, true, { ignored: true }],
        missing: undefined,
      })
    ).toEqual({
      string: "value",
      number: 1,
      boolean: true,
      object: '{"ok":true}',
      array: '["a",1,true,{"ignored":true}]',
    });
  });
});
