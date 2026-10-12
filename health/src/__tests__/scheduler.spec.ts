import { describe, expect, it } from "@jest/globals";
import { ProbeScheduler, withDeadline } from "../scheduler.js";
import type { CheckDefinition } from "../types.js";

const definition: CheckDefinition = {
  key: "example",
  group: "test",
  title: "Example",
  kind: "http",
  target: {},
  intervalSeconds: 1,
  timeoutMs: 25,
  severity: "warning",
};

describe("probe scheduler", () => {
  it("runs due checks with jitter and records the last run", async () => {
    const scheduler = new ProbeScheduler(1, () => 0);
    expect(scheduler.due(definition, 0)).toBe(true);
    expect(
      await scheduler.run(
        definition,
        async () => ({ status: "ok", summary: "ok" }),
        0
      )
    ).toEqual({ status: "ok", summary: "ok" });
    expect(scheduler.due(definition, 500)).toBe(false);
    expect(scheduler.due(definition, 1000)).toBe(true);
    expect(scheduler.due({ ...definition, enabled: false }, 1000)).toBe(false);
  });

  it("uses the default concurrency and jitter", () => {
    expect(new ProbeScheduler().due(definition, 0)).toBe(true);
  });

  it("enforces concurrency and a hard deadline", async () => {
    const scheduler = new ProbeScheduler(1);
    let release = (): void => undefined;
    const pending = scheduler.run(
      definition,
      () =>
        new Promise((resolve) => {
          release = () => resolve({ status: "ok", summary: "ok" });
        })
    );
    expect(
      (
        await scheduler.run(definition, async () => ({
          status: "ok",
          summary: "ok",
        }))
      ).status
    ).toBe("unknown");
    release();
    await pending;
    const slow = await scheduler.run(
      definition,
      () => new Promise(() => undefined)
    );
    expect(slow.errorClass).toBe("timeout");
    const value = await withDeadline(25, async () => "ok");
    expect(value).toBe("ok");
  });
});
