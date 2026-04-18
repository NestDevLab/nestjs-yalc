import { jest, describe, expect, it } from "@jest/globals";
import type { IApiCallStrategy } from "../context-call.interface.js";
import { ConditionalCallStrategy } from "../strategies/conditional-call.strategy.js";
import { FallbackCallStrategy } from "../strategies/fallback-call.strategy.js";
import { ShadowCallStrategy } from "../strategies/shadow-call.strategy.js";

function callStrategy(overrides: Partial<IApiCallStrategy> = {}) {
  return {
    call: jest.fn(async () => ({ data: "call" })),
    get: jest.fn(async () => ({ data: "get" })),
    post: jest.fn(async () => ({ data: "post" })),
    ...overrides,
  } satisfies IApiCallStrategy;
}

describe("ConditionalCallStrategy", () => {
  it("delegates calls when enabled", async () => {
    const target = callStrategy();
    const strategy = new ConditionalCallStrategy(target, {
      enabled: () => true,
    });

    await expect(strategy.call("/items")).resolves.toEqual({ data: "call" });
    await expect(strategy.get("/items")).resolves.toEqual({ data: "get" });
    await expect(strategy.post("/items")).resolves.toEqual({ data: "post" });
  });

  it("delegates calls when no condition is configured", async () => {
    const strategy = new ConditionalCallStrategy(callStrategy());

    await expect(strategy.call("/items")).resolves.toEqual({ data: "call" });
  });

  it("returns a disabled response when disabled", async () => {
    const target = callStrategy();
    const strategy = new ConditionalCallStrategy(target, {
      enabled: false,
      disabledResponse: { data: "disabled" },
    });

    await expect(strategy.call("/items")).resolves.toEqual({
      data: "disabled",
    });
    expect(target.call).not.toHaveBeenCalled();
  });

  it("throws the default disabled error", async () => {
    const strategy = new ConditionalCallStrategy(callStrategy(), {
      enabled: false,
    });

    await expect(strategy.get("/items")).rejects.toThrow("disabled");
  });

  it("throws a custom disabled error", async () => {
    const strategy = new ConditionalCallStrategy(callStrategy(), {
      enabled: false,
      disabledError: () => new Error("custom disabled"),
    });

    await expect(strategy.post("/items")).rejects.toThrow("custom disabled");
  });

  it("throws a custom disabled error instance", async () => {
    const strategy = new ConditionalCallStrategy(callStrategy(), {
      enabled: false,
      disabledError: new Error("disabled instance"),
    });

    await expect(strategy.call("/items")).rejects.toThrow("disabled instance");
  });
});

describe("FallbackCallStrategy", () => {
  it("requires at least one strategy", () => {
    expect(() => new FallbackCallStrategy([])).toThrow("at least one");
  });

  it("falls back to the next strategy after a failure", async () => {
    const first = callStrategy({
      call: jest.fn(async () => {
        throw new Error("primary failed");
      }),
    });
    const second = callStrategy();
    const strategy = new FallbackCallStrategy([first, second]);

    await expect(strategy.call("/items")).resolves.toEqual({ data: "call" });
    expect(first.call).toHaveBeenCalled();
    expect(second.call).toHaveBeenCalled();
  });

  it("stops fallback when the predicate rejects it", async () => {
    const error = new Error("do not retry");
    const strategy = new FallbackCallStrategy(
      [
        callStrategy({
          get: jest.fn(async () => {
            throw error;
          }),
        }),
        callStrategy(),
      ],
      {
        shouldFallback: () => false,
      }
    );

    await expect(strategy.get("/items")).rejects.toThrow(error);
  });

  it("throws the last error after all strategies fail", async () => {
    const strategy = new FallbackCallStrategy([
      callStrategy({
        post: jest.fn(async () => {
          throw new Error("first failed");
        }),
      }),
      callStrategy({
        post: jest.fn(async () => {
          throw new Error("last failed");
        }),
      }),
    ]);

    await expect(strategy.post("/items")).rejects.toThrow("last failed");
  });
});

describe("ShadowCallStrategy", () => {
  it("requires at least one shadow strategy", () => {
    expect(() => new ShadowCallStrategy(callStrategy(), [])).toThrow(
      "at least one"
    );
  });

  it("returns the primary response and triggers shadows", async () => {
    const primary = callStrategy();
    const shadow = callStrategy();
    const strategy = new ShadowCallStrategy(primary, [shadow]);

    await expect(strategy.call("/items")).resolves.toEqual({ data: "call" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(primary.call).toHaveBeenCalled();
    expect(shadow.call).toHaveBeenCalled();
  });

  it("ignores fire-and-forget shadow failures", async () => {
    const strategy = new ShadowCallStrategy(callStrategy(), [
      callStrategy({
        call: jest.fn(async () => {
          throw new Error("shadow failed");
        }),
      }),
    ]);

    await expect(strategy.call("/items")).resolves.toEqual({ data: "call" });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("throws shadow failures when configured to await and throw", async () => {
    const strategy = new ShadowCallStrategy(
      callStrategy(),
      [
        callStrategy({
          get: jest.fn(async () => {
            throw new Error("shadow failed");
          }),
        }),
      ],
      {
        awaitShadows: true,
        shadowErrorMode: "throw",
      }
    );

    await expect(strategy.get("/items")).rejects.toThrow("shadow failed");
  });

  it("awaits and ignores shadow failures when configured", async () => {
    const strategy = new ShadowCallStrategy(
      callStrategy(),
      [
        callStrategy({
          post: jest.fn(async () => {
            throw new Error("shadow failed");
          }),
        }),
      ],
      {
        awaitShadows: true,
        shadowErrorMode: "ignore",
      }
    );

    await expect(strategy.post("/items")).resolves.toEqual({ data: "post" });
  });

  it("awaits shadows automatically when throw mode is configured", async () => {
    const strategy = new ShadowCallStrategy(
      callStrategy(),
      [
        callStrategy({
          call: jest.fn(async () => {
            throw new Error("shadow failed");
          }),
        }),
      ],
      {
        shadowErrorMode: "throw",
      }
    );

    await expect(strategy.call("/items")).rejects.toThrow("shadow failed");
  });
});
