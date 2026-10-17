import { describe, expect, it } from "@jest/globals";
import { AuthError, createAuthCore } from "../index.js";
import {
  contextFor,
  ownData,
  safeTime,
  verifiedIdentity,
} from "../core/auth-validation.js";
import {
  harness,
  cookie,
  readCookie,
} from "../../../test/auth/session-core/fixtures/fixtures.mjs";

describe("session boundary validation", () => {
  it("rejects malformed configuration and browser-supplied account hints", async () => {
    const h = harness(createAuthCore);
    expect(() => createAuthCore({ ...h.options, idleTtlMs: 0 })).toThrow(
      expect.objectContaining({ code: "invalid_config" }),
    );
    await expect(
      h.core.login({
        providerId: "external",
        proof: "alice-proof",
        context: cookie(),
        accountId: "account-bob",
      } as never),
    ).rejects.toMatchObject({ code: "invalid_input" });
    expect(h.store.snapshot().sessions).toHaveLength(0);
  });

  it("does not invoke an accessor in resolver output", async () => {
    let calls = 0;
    const row = Object.defineProperty({}, "accountId", {
      enumerable: true,
      get() {
        calls++;
        return "account-alice";
      },
    });
    const h = harness(createAuthCore, { resolveIdentity: async () => row });
    await expect(h.login()).rejects.toMatchObject({
      code: "authentication_denied",
    });
    expect(calls).toBe(0);
  });

  it("rejects a foreign cookie origin before touching a session", async () => {
    const h = harness(createAuthCore);
    const issued = await h.login();
    const before = h.store.snapshot();
    await expect(
      h.core.authenticate({
        token: issued.token,
        context: cookie({
          origin: "https://evil.invalid",
          csrf: issued.csrfToken,
        }),
      }),
    ).rejects.toMatchObject({ code: "csrf_denied" });
    expect(h.store.snapshot()).toEqual(before);
    expect(
      (
        await h.core.authenticate({
          token: issued.token,
          context: readCookie(),
        })
      ).accountId,
    ).toBe("account-alice");
  });
});

describe("hostile boundaries and port faults", () => {
  it("maps port-owned AuthError and prototype traps to storage_unavailable", async () => {
    for (const thrown of [
      new AuthError("synthetic-private-port-marker" as never),
      new Proxy(new AuthError("storage_unavailable"), {
        getPrototypeOf() {
          throw Error("synthetic-proxy-port-marker");
        },
      }),
    ]) {
      const h = harness(createAuthCore, {
        sessions: {
          transaction: async () => {
            throw thrown;
          },
        },
      });
      let error: unknown;
      try {
        await h.core.authenticate({
          token: "x".repeat(43),
          context: readCookie(),
        });
      } catch (caught) {
        error = caught;
      }
      expect(error).toMatchObject({ code: "storage_unavailable" });
      expect(String(error)).not.toMatch(
        /synthetic-(private|proxy)-port-marker/,
      );
      expect(h.store.snapshot().sessions).toHaveLength(0);
    }
  });

  it("maps a transaction method's counterfeit AuthError to storage_unavailable", async () => {
    const h = harness(createAuthCore, {
      sessions: {
        transaction: async (work: (tx: object) => Promise<unknown>) =>
          work({
            getToken: async () => {
              throw new AuthError("synthetic-private-port-marker" as never);
            },
          }),
      } as never,
    });
    let error: unknown;
    try {
      await h.core.authenticate({
        token: "x".repeat(43),
        context: readCookie(),
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: "storage_unavailable" });
    expect(String(error)).not.toContain("synthetic-private-port-marker");
  });

  it("validates the exact origin and verifier snapshots it retains", async () => {
    const base = harness(createAuthCore);
    let reads = 0;
    const origins = ["https://app.example"];
    Object.defineProperty(origins, "0", {
      configurable: true,
      get() {
        return ++reads <= 2
          ? "https://app.example"
          : "http://unqualified.invalid";
      },
    });
    const originCore = createAuthCore({
      ...base.options,
      allowedOrigins: origins,
    });
    await expect(
      originCore.login({
        providerId: "external",
        proof: "alice-proof",
        context: cookie({ origin: "http://unqualified.invalid" }),
      }),
    ).rejects.toMatchObject({ code: "csrf_denied" });
    let iterations = 0;
    class SwitchingProviders extends Map<
      string,
      (proof: unknown) => Promise<unknown>
    > {
      override [Symbol.iterator](): MapIterator<
        [string, (proof: unknown) => Promise<unknown>]
      > {
        iterations++;
        return (
          iterations === 1
            ? new Map([["external", async () => null]])
            : new Map([
                [
                  "late",
                  async () => ({
                    issuer: "https://idp.example",
                    subject: "alice",
                    authTime: 10000,
                    methods: ["external"],
                  }),
                ],
              ])
        )[Symbol.iterator]();
      }
    }
    const switched = harness(createAuthCore, {
      providers: new SwitchingProviders(),
    });
    await expect(
      switched.core.login({
        providerId: "late",
        proof: "unused",
        context: cookie(),
      }),
    ).rejects.toMatchObject({ code: "authentication_denied" });
  });
  it("maps hostile input and provider traps to safe codes without marker disclosure", async () => {
    const h = harness(createAuthCore);
    const request = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw Error("synthetic-sensitive-marker");
        },
      },
    );
    await expect(h.core.login(request as never)).rejects.toMatchObject({
      code: "invalid_input",
    });
    let methodTrapCalls = 0;
    const methods = new Proxy(["external"], {
      ownKeys() {
        methodTrapCalls++;
        throw Error("synthetic-provider-marker");
      },
    });
    const provider = harness(createAuthCore, {
      providers: new Map([
        [
          "external",
          async () => ({
            issuer: "https://idp.example",
            subject: "alice",
            authTime: 10000,
            methods,
          }),
        ],
      ]),
    });
    await expect(provider.login()).rejects.toMatchObject({
      code: "authentication_denied",
    });
    expect(methodTrapCalls).toBeGreaterThan(0);
    expect(JSON.stringify(provider.store.snapshot())).not.toContain(
      "synthetic-provider-marker",
    );
    expect(() => ownData(Object.create({}), [], [], "invalid_input")).toThrow(
      expect.objectContaining({ code: "invalid_input" }),
    );
  });

  it("pins factory verifier, TTL and clock callbacks against later option mutation", async () => {
    const h = harness(createAuthCore);
    h.options.providers.set("late", async () => ({
      issuer: "https://idp.example",
      subject: "alice",
      authTime: 10000,
      methods: ["external"],
    }));
    h.options.absoluteTtlMs = 100000;
    h.options.now = () => 10050;
    await expect(
      h.core.login({ providerId: "late", proof: "unused", context: cookie() }),
    ).rejects.toMatchObject({ code: "authentication_denied" });
    expect((await h.login()).profile.expiresAt).toBe(11000);
  });

  it("denies invalid identifiers and context member types before a transaction", async () => {
    const h = harness(createAuthCore);
    await expect(
      h.core.login({ providerId: "", proof: "alice-proof", context: cookie() }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    for (const context of [
      cookie({ origin: 12 }),
      cookie({ secFetchSite: 12 }),
      cookie({ csrf: 12 }),
    ]) {
      await expect(
        h.core.login({ providerId: "external", proof: "alice-proof", context }),
      ).rejects.toMatchObject({ code: "invalid_input" });
    }
    await expect(
      h.core.authenticate({ token: "", context: readCookie() }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(h.core.revokeAll("")).rejects.toMatchObject({
      code: "invalid_input",
    });
    expect(h.store.snapshot().sessions).toHaveLength(0);
  });

  it("fails closed when clock, randomness or expiry arithmetic cannot be trusted", async () => {
    const badRandom = harness(createAuthCore, {
      randomBytes: () => {
        throw Error("host entropy offline");
      },
    });
    await expect(badRandom.login()).rejects.toMatchObject({
      code: "invalid_config",
    });
    const badClock = harness(createAuthCore, {
      now: () => {
        throw Error("host clock offline");
      },
    });
    await expect(badClock.login()).rejects.toMatchObject({
      code: "invalid_config",
    });
    const overflow = harness(createAuthCore, {
      absoluteTtlMs: Number.MAX_SAFE_INTEGER,
      idleTtlMs: 100,
    });
    await expect(overflow.login()).rejects.toMatchObject({
      code: "invalid_config",
    });
    expect(badRandom.store.snapshot().sessions).toHaveLength(0);
    expect(badClock.store.snapshot().sessions).toHaveLength(0);
    expect(overflow.store.snapshot().sessions).toHaveLength(0);
  });

  it("denies resolver failures and malformed configured origins before issuing credentials", async () => {
    const h = harness(createAuthCore, {
      resolveIdentity: async () => {
        throw Error("private directory failure");
      },
    });
    await expect(h.login()).rejects.toMatchObject({
      code: "authentication_unavailable",
    });
    expect(h.store.snapshot().sessions).toHaveLength(0);
    expect(() =>
      createAuthCore({ ...h.options, allowedOrigins: ["not a URL"] }),
    ).toThrow(expect.objectContaining({ code: "invalid_config" }));
  });

  it("refuses hostile plain-data and verified-identity returns without invoking accessors", () => {
    expect(() => safeTime(NaN)).toThrow(
      expect.objectContaining({ code: "session_expired" }),
    );
    expect(() => ownData(new Date(), [], [], "invalid_input")).toThrow(
      expect.objectContaining({ code: "invalid_input" }),
    );
    for (const value of [null, 5, [], new Date(), { issuer: "x" }]) {
      expect(() => verifiedIdentity(value, 10000)).toThrow(
        expect.objectContaining({ code: "authentication_denied" }),
      );
    }
    let getterCalls = 0;
    const accessor = Object.defineProperty({}, "issuer", {
      enumerable: true,
      get() {
        getterCalls++;
        return "https://idp.example";
      },
    });
    expect(() => verifiedIdentity(accessor, 10000)).toThrow(
      expect.objectContaining({ code: "authentication_denied" }),
    );
    expect(getterCalls).toBe(0);
    const throwingProxy = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw Error("hostile proxy");
        },
      },
    );
    expect(() => verifiedIdentity(throwingProxy, 10000)).toThrow(
      expect.objectContaining({ code: "authentication_denied" }),
    );
    expect(() =>
      contextFor({ transport: "bearer", method: 1 }, "login", []),
    ).toThrow(expect.objectContaining({ code: "invalid_input" }));
    const sparse = new Array(1);
    const indexedGetter = Object.defineProperty(["external"], "0", {
      get() {
        getterCalls++;
        return "external";
      },
    });
    for (const methods of [sparse, indexedGetter]) {
      expect(() =>
        verifiedIdentity(
          {
            issuer: "https://idp.example",
            subject: "alice",
            authTime: 10000,
            methods,
          },
          10000,
        ),
      ).toThrow(expect.objectContaining({ code: "authentication_denied" }));
    }
    expect(getterCalls).toBe(0);
    const optionsTrap = new Proxy(
      {},
      {
        get() {
          throw Error("synthetic-options-marker");
        },
      },
    );
    expect(() => createAuthCore(optionsTrap as never)).toThrow(
      expect.objectContaining({ code: "invalid_config" }),
    );
  });
});
