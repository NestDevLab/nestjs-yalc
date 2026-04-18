import {
  createObservabilityOptionsFromEnv,
  normalizeObservabilityOptions,
} from "../observability-options.js";

describe("observability options", () => {
  afterEach(() => {
    delete process.env.YALC_OBSERVABILITY_ENABLED;
    delete process.env.YALC_OTEL_SERVICE_NAME;
    delete process.env.YALC_OTEL_ENDPOINT;
    delete process.env.YALC_OBSERVABILITY_EVENT_LISTEN_TO;
    delete process.env.YALC_OBSERVABILITY_EVENT_IGNORE;
    delete process.env.YALC_OBSERVABILITY_INCLUDE_EVENT_PAYLOAD;
    delete process.env.YALC_OBSERVABILITY_PAYLOAD_MASK;
    delete process.env.YALC_OBSERVABILITY_FAILURE_MODE;
  });

  it("normalizes defaults", () => {
    expect(
      normalizeObservabilityOptions({ serviceName: "task-system" })
    ).toMatchObject({
      enabled: true,
      serviceName: "task-system",
      otlpEndpoint: "http://127.0.0.1:4318",
      eventManager: {
        enabled: true,
        listenTo: ["**"],
        ignore: ["observability.**"],
      },
      payload: {
        include: false,
      },
      failureMode: "ignore",
    });
  });

  it("builds options from environment variables", () => {
    process.env.YALC_OBSERVABILITY_ENABLED = "true";
    process.env.YALC_OTEL_SERVICE_NAME = "task-app";
    process.env.YALC_OTEL_ENDPOINT = "http://collector:4318/";
    process.env.YALC_OBSERVABILITY_EVENT_LISTEN_TO = "task.**,api.**";
    process.env.YALC_OBSERVABILITY_EVENT_IGNORE = "debug.**";
    process.env.YALC_OBSERVABILITY_INCLUDE_EVENT_PAYLOAD = "true";
    process.env.YALC_OBSERVABILITY_PAYLOAD_MASK = "token,password";
    process.env.YALC_OBSERVABILITY_FAILURE_MODE = "throw";

    expect(createObservabilityOptionsFromEnv("fallback")).toEqual({
      enabled: true,
      serviceName: "task-app",
      otlpEndpoint: "http://collector:4318/",
      eventManager: {
        enabled: true,
        listenTo: ["task.**", "api.**"],
        ignore: ["debug.**"],
      },
      payload: {
        include: true,
        mask: ["token", "password"],
      },
      failureMode: "throw",
    });
  });
});
