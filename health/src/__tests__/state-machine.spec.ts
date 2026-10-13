import { describe, expect, it } from "@jest/globals";
import { initialCheckState, transitionCheck } from "../state-machine.js";
import type { CheckState, ProbeResult } from "../types.js";

const ok: ProbeResult = { status: "ok", summary: "healthy" };
const fail: ProbeResult = { status: "fail", summary: "unhealthy" };

describe("health state machine", () => {
  it("opens only after the failure threshold and recovers after the recovery threshold", () => {
    let state = initialCheckState(0);
    expect(state.status).toBe("unknown");
    let output = transitionCheck({
      state,
      result: fail,
      now: 1,
      incidentId: "i1",
    });
    expect(output.event).toBeNull();
    expect(output.state.status).toBe("unknown");
    output = transitionCheck({
      state: output.state,
      result: fail,
      now: 2,
      incidentId: "i1",
    });
    expect(output.event).toBe("open");
    expect(output.state.openIncidentId).toBe("i1");
    state = output.state;
    const stillOpen = transitionCheck({ state, result: fail, now: 2.5 });
    expect(stillOpen.state.openIncidentId).toBe("i1");
    state = stillOpen.state;
    output = transitionCheck({ state, result: ok, now: 3 });
    expect(output.event).toBeNull();
    expect(output.state.status).toBe("fail");
    output = transitionCheck({ state: output.state, result: ok, now: 4 });
    expect(output.event).toBe("recover");
    expect(output.recoveredIncidentId).toBe("i1");
    expect(output.state.status).toBe("ok");
    expect(output.state.openIncidentId).toBeUndefined();
  });

  it("blocks a child without opening its incident", () => {
    const output = transitionCheck({
      state: initialCheckState(0),
      result: fail,
      now: 10,
      parentFailing: true,
    });
    expect(output.state.status).toBe("blocked");
    expect(output.state.openIncidentId).toBeUndefined();
    expect(output.event).toBeNull();
  });

  it("holds unknown during startup or pid-change grace", () => {
    const output = transitionCheck({
      state: initialCheckState(0),
      result: fail,
      now: 20,
      graceUntil: 100,
    });
    expect(output.state.status).toBe("unknown");
    expect(output.state.consecutiveFail).toBe(0);
  });

  it("marks flapping once on four transitions and clears after stability", () => {
    const base: CheckState = {
      ...initialCheckState(0),
      status: "ok",
      transitions: [1, 2, 3],
    };
    const flap = transitionCheck({
      state: base,
      result: { status: "disabled", summary: "paused" },
      now: 4,
    });
    expect(flap.event).toBe("flapping");
    expect(flap.state.flapping).toBe(true);
    const suppressed = transitionCheck({
      state: flap.state,
      result: ok,
      now: 5,
    });
    expect(suppressed.event).toBeNull();
    const stable = transitionCheck({
      state: suppressed.state,
      result: ok,
      now: 30 * 60 * 1000 + 6,
    });
    expect(stable.state.flapping).toBe(false);
    expect(stable.state.transitions).toEqual([]);
    const next = transitionCheck({
      state: stable.state,
      result: ok,
      now: 30 * 60 * 1000 + 7,
    });
    expect(next.state.flapping).toBe(false);
    expect(next.event).toBeNull();
  });

  it("keeps disabled and unknown explicit", () => {
    const disabled = transitionCheck({
      state: initialCheckState(0),
      result: { status: "disabled", summary: "paused" },
      now: 1,
    });
    expect(disabled.state.status).toBe("disabled");
    const unknown = transitionCheck({
      state: disabled.state,
      result: { status: "unknown", summary: "no data" },
      now: 2,
    });
    expect(unknown.state.status).toBe("unknown");
  });

  it("generates an incident id when one is not supplied", () => {
    const output = transitionCheck({
      state: initialCheckState(0),
      result: fail,
      now: 42,
      failThreshold: 1,
    });
    expect(output.state.openIncidentId).toBe("42");
  });

  it("reports a flapping recovery and retains the resolved incident id", () => {
    let state = initialCheckState(0);
    for (const [index, result] of [fail, ok, fail].entries()) {
      state = transitionCheck({
        state,
        result,
        now: index + 1,
        failThreshold: 1,
        recoverThreshold: 1,
      }).state;
    }
    const output = transitionCheck({
      state,
      result: ok,
      now: 4,
      recoverThreshold: 1,
    });
    expect(output.event).toBe("flapping");
    expect(output.recoveredIncidentId).toBe("3");
    expect(output.state.openIncidentId).toBeUndefined();
  });
});
