import { Observed } from "../decorators/observed.decorator.js";
import { jest } from "@jest/globals";

describe("Observed", () => {
  it("measures decorated methods when telemetry is available", () => {
    const telemetry = {
      measure: jest.fn((_name: string, operation: () => unknown) => operation()),
    };

    class Example {
      telemetry = telemetry;

      @Observed("custom.operation")
      run(value: string) {
        return `ok:${value}`;
      }
    }

    const example = new Example();

    expect(example.run("value")).toBe("ok:value");
    expect(telemetry.measure).toHaveBeenCalledWith(
      "custom.operation",
      expect.any(Function)
    );
  });

  it("falls back to the original method when telemetry is unavailable", () => {
    class Example {
      @Observed()
      run() {
        return "ok";
      }
    }

    expect(new Example().run()).toBe("ok");
  });

  it("uses telemetryService as the conventional injected property name", () => {
    const telemetryService = {
      measure: jest.fn((_name: string, operation: () => unknown) => operation()),
    };

    class Example {
      telemetryService = telemetryService;

      @Observed()
      run() {
        return "ok";
      }
    }

    expect(new Example().run()).toBe("ok");
    expect(telemetryService.measure).toHaveBeenCalledWith(
      "Example.run",
      expect.any(Function)
    );
  });
});
