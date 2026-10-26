import { describe, it, expect, jest } from "@jest/globals";
import { CompositeEventStrategy } from "../strategies/composite-event.strategy.js";
import { ShadowCallStrategy } from "../strategies/shadow-call.strategy.js";
const call = () => ({
  call: jest.fn(async () => ({ data: true })),
  get: jest.fn(async () => ({ data: true })),
  post: jest.fn(async () => ({ data: true })),
});
describe("async fanout failure normalization", () => {
  it.each(["ignore", "throw"] as const)(
    "starts every composite branch with %s policy after synchronous failure",
    async (errorMode) => {
      const error = new Error("sync");
      const later = jest.fn(async () => "later");
      const strategy = new CompositeEventStrategy(
        [
          {
            emit: () => "",
            emitAsync: () => {
              throw error;
            },
          },
          { emit: () => "", emitAsync: later },
          {
            emit: () => "",
            emitAsync: () => Promise.reject(new Error("async")),
          },
        ],
        { errorMode },
      );
      const execution = strategy.emitAsync("event", {});
      if (errorMode === "throw") await expect(execution).rejects.toBe(error);
      else await expect(execution).resolves.toEqual(["later"]);
      expect(later).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    { awaitShadows: false, shadowErrorMode: "ignore" as const },
    { awaitShadows: true, shadowErrorMode: "ignore" as const },
    { awaitShadows: true, shadowErrorMode: "throw" as const },
    { awaitShadows: false, shadowErrorMode: "throw" as const },
  ])("normalizes shadow throws with %j", async (options) => {
    const first = call();
    first.call.mockImplementation(() => {
      throw new Error("sync");
    });
    const later = call();
    const rejected = call();
    rejected.call.mockRejectedValue(new Error("async"));
    const strategy = new ShadowCallStrategy(
      call(),
      [first, later, rejected],
      options,
    );
    const execution = strategy.call("/write");
    if (options.awaitShadows && options.shadowErrorMode === "throw")
      await expect(execution).rejects.toThrow("sync");
    else await expect(execution).resolves.toEqual({ data: true });
    expect(later.call).toHaveBeenCalledTimes(1);
  });
  it("does not start shadows when the primary synchronously fails", async () => {
    const primary = call();
    primary.call.mockImplementation(() => {
      throw new Error("primary");
    });
    const shadow = call();
    const strategy = new ShadowCallStrategy(primary, [shadow]);
    await expect(strategy.call("/write")).rejects.toThrow("primary");
    expect(shadow.call).not.toHaveBeenCalled();
  });
});
