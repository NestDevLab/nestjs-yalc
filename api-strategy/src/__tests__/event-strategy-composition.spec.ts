import { jest, describe, expect, it } from "@jest/globals";
import type { IEventStrategy } from "../context-event.interface.js";
import { CompositeEventStrategy } from "../strategies/composite-event.strategy.js";
import { ConditionalEventStrategy } from "../strategies/conditional-event.strategy.js";

function eventStrategy(
  overrides: Partial<IEventStrategy<object, boolean>> & {
    onModuleDestroy?: () => Promise<void>;
  } = {}
) {
  return {
    emit: jest.fn(() => true),
    emitAsync: jest.fn(async () => true),
    ...overrides,
  } satisfies IEventStrategy<object, boolean> & {
    onModuleDestroy?: () => Promise<void>;
  };
}

describe("CompositeEventStrategy", () => {
  it("requires at least one strategy", () => {
    expect(() => new CompositeEventStrategy([])).toThrow("at least one");
  });

  it("emits to every strategy synchronously", () => {
    const first = eventStrategy();
    const second = eventStrategy({ emit: jest.fn(() => false) });
    const strategy = new CompositeEventStrategy([first, second]);

    const result = strategy.emit("event.name", { ok: true });

    expect(result).toEqual([true, false]);
    expect(first.emit).toHaveBeenCalledWith(
      "event.name",
      { ok: true },
      undefined
    );
    expect(second.emit).toHaveBeenCalledWith(
      "event.name",
      { ok: true },
      undefined
    );
  });

  it("throws sync errors by default", () => {
    const error = new Error("sync failure");
    const strategy = new CompositeEventStrategy([
      eventStrategy({
        emit: jest.fn(() => {
          throw error;
        }),
      }),
    ]);

    expect(() => strategy.emit("event.name", {})).toThrow(error);
  });

  it("ignores sync errors when configured", () => {
    const strategy = new CompositeEventStrategy(
      [
        eventStrategy({
          emit: jest.fn(() => {
            throw new Error("sync failure");
          }),
        }),
        eventStrategy(),
      ],
      { errorMode: "ignore" }
    );

    expect(strategy.emit("event.name", {})).toEqual([true]);
  });

  it("emits to every strategy asynchronously", async () => {
    const first = eventStrategy();
    const second = eventStrategy({ emitAsync: jest.fn(async () => false) });
    const strategy = new CompositeEventStrategy([first, second]);

    await expect(
      strategy.emitAsync("event.name", { ok: true })
    ).resolves.toEqual([true, false]);
  });

  it("throws async errors by default", async () => {
    const error = new Error("async failure");
    const strategy = new CompositeEventStrategy([
      eventStrategy({
        emitAsync: jest.fn(async () => {
          throw error;
        }),
      }),
    ]);

    await expect(strategy.emitAsync("event.name", {})).rejects.toThrow(error);
  });

  it("ignores async errors when configured", async () => {
    const strategy = new CompositeEventStrategy(
      [
        eventStrategy({
          emitAsync: jest.fn(async () => {
            throw new Error("async failure");
          }),
        }),
        eventStrategy(),
      ],
      { errorMode: "ignore" }
    );

    await expect(strategy.emitAsync("event.name", {})).resolves.toEqual([true]);
  });

  it("destroys nested strategies that implement module destroy", async () => {
    const onModuleDestroy = jest.fn(async () => undefined);
    const strategy = new CompositeEventStrategy([
      eventStrategy({ onModuleDestroy }),
      eventStrategy(),
    ]);

    await strategy.onModuleDestroy();

    expect(onModuleDestroy).toHaveBeenCalled();
  });
});

describe("ConditionalEventStrategy", () => {
  it("emits when enabled", () => {
    const target = eventStrategy();
    const strategy = new ConditionalEventStrategy(target, {
      enabled: () => true,
    });

    expect(strategy.emit("event.name", {})).toBe(true);
    expect(target.emit).toHaveBeenCalled();
  });

  it("returns the disabled result when disabled", () => {
    const target = eventStrategy();
    const strategy = new ConditionalEventStrategy(target, {
      enabled: false,
      disabledResult: false,
    });

    expect(strategy.emit("event.name", {})).toBe(false);
    expect(target.emit).not.toHaveBeenCalled();
  });

  it("skips events rejected by the predicate", async () => {
    const target = eventStrategy();
    const strategy = new ConditionalEventStrategy(target, {
      shouldEmit: () => false,
      disabledResult: false,
    });

    await expect(strategy.emitAsync("event.name", {})).resolves.toBe(false);
    expect(target.emitAsync).not.toHaveBeenCalled();
  });

  it("delegates async events when enabled and accepted", async () => {
    const target = eventStrategy();
    const strategy = new ConditionalEventStrategy(target, {
      shouldEmit: () => true,
    });

    await expect(strategy.emitAsync("event.name", {})).resolves.toBe(true);
    expect(target.emitAsync).toHaveBeenCalled();
  });

  it("destroys the wrapped strategy when supported", async () => {
    const onModuleDestroy = jest.fn(async () => undefined);
    const strategy = new ConditionalEventStrategy(
      eventStrategy({ onModuleDestroy })
    );

    await strategy.onModuleDestroy();

    expect(onModuleDestroy).toHaveBeenCalled();
  });

  it("ignores destroy when the wrapped strategy has no lifecycle hook", async () => {
    const strategy = new ConditionalEventStrategy(eventStrategy());

    await expect(strategy.onModuleDestroy()).resolves.toBeUndefined();
  });
});
