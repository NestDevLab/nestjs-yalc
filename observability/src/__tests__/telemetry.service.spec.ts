import {
  TelemetryService,
  toTelemetryAttributes,
} from "../telemetry.service.js";
import { normalizeObservabilityOptions } from "../observability-options.js";
import { jest } from "@jest/globals";

describe("TelemetryService", () => {
  it("runs operations without telemetry when disabled", async () => {
    const service = new TelemetryService(
      normalizeObservabilityOptions({
        enabled: false,
        serviceName: "test",
      }),
      {} as any
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
      }),
      {} as any
    );

    await expect(
      service.measure("test.failure", async () => {
        throw new Error("failed");
      })
    ).rejects.toThrow("failed");
  });

  it("records event payloads with masked data", () => {
    const sdk = {
      exportLogRecord: jest.fn(),
    };
    const service = new TelemetryService(
      normalizeObservabilityOptions({
        enabled: true,
        serviceName: "test",
        payload: {
          include: true,
          mask: ["token"],
        },
      }),
      sdk as any
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

    expect(sdk.exportLogRecord).toHaveBeenCalledWith(
      "task.created",
      expect.objectContaining({
        "yalc.event.name": "task.created",
        "yalc.event.level": "warn",
        "yalc.event.payload":
          '{"token":"[masked]","nested":{"accessToken":"[masked]","visible":"ok"}}',
      }),
      "warn"
    );
  });

  it("records event errors as telemetry attributes", () => {
    const sdk = {
      exportLogRecord: jest.fn(),
    };
    const service = new TelemetryService(
      normalizeObservabilityOptions({
        enabled: true,
        serviceName: "test",
      }),
      sdk as any
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

    expect(sdk.exportLogRecord).toHaveBeenCalledWith(
      "task.failed",
      expect.objectContaining({
        "yalc.event.has_error": true,
        "yalc.error.name": "TaskError",
        "yalc.error.message": "Task failed",
        "yalc.error.code": "TASK_FAILED",
      }),
      "error"
    );
  });

  it("respects throw failure mode for telemetry backend failures", () => {
    const service = new TelemetryService(
      normalizeObservabilityOptions({
        enabled: true,
        serviceName: "test",
        failureMode: "throw",
      }),
      {
        exportLogRecord: jest.fn(() => {
          throw new Error("telemetry failed");
        }),
      } as any
    );

    expect(() =>
      service.recordYalcEvent("task.created", {
        eventName: "task.created",
      } as any)
    ).toThrow("telemetry failed");
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
