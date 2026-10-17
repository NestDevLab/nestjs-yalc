import { describe, expect, it, test } from "@jest/globals";
import assert from "node:assert/strict";
import { createAuthCore } from "../index.js";
import {
  harness,
  digest,
  cookie,
  readCookie,
  readBearer,
  bearer,
} from "../../../test/auth/session-core/fixtures/fixtures.mjs";

describe("opaque session core", () => {
  it("commits a digest-only cookie session and returns detached profiles", async () => {
    const h = harness(createAuthCore);
    const issued = await h.login();
    expect(
      h.store.snapshot().events.map((event: { kind: string }) => event.kind),
    ).toEqual(["session_created"]);
    expect(JSON.stringify(h.store.snapshot())).not.toContain(issued.token);
    issued.profile.methods.push("local mutation");
    const profile = await h.core.authenticate({
      token: issued.token,
      context: readCookie(),
    });
    expect(profile.methods).toEqual(["external"]);
    expect(profile.accountId).toBe("account-alice");
  });

  it("rotates one branch, commits reuse revocation, and rejects its winner", async () => {
    const h = harness(createAuthCore);
    const original = await h.login();
    const input = {
      token: original.token,
      context: cookie({ csrf: original.csrfToken }),
    };
    const outcomes = await Promise.allSettled([
      h.core.refresh(input),
      h.core.refresh(input),
    ]);
    expect(
      outcomes.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const winner = outcomes.find(
      (result) => result.status === "fulfilled",
    ) as PromiseFulfilledResult<{ token: string }>;
    await expect(
      h.core.authenticate({ token: winner.value.token, context: readCookie() }),
    ).rejects.toMatchObject({ code: "session_denied" });
    expect(
      h.store.snapshot().events.map((event: { kind: string }) => event.kind),
    ).toEqual(["session_created", "session_refreshed", "session_reused"]);
  });

  it("keeps bearer and cookie transport boundaries separate", async () => {
    const h = harness(createAuthCore);
    const issued = await h.login("alice-proof", bearer());
    expect(issued.csrfToken).toBeUndefined();
    expect(
      (
        await h.core.authenticate({
          token: issued.token,
          context: readBearer(),
        })
      ).accountId,
    ).toBe("account-alice");
    await expect(
      h.core.authenticate({ token: issued.token, context: readCookie() }),
    ).rejects.toMatchObject({ code: "session_denied" });
  });

  it("rolls back lifecycle when outbox insert fails", async () => {
    const h = harness(createAuthCore);
    h.store.setEventUnavailable(true);
    await expect(h.login()).rejects.toMatchObject({
      code: "storage_unavailable",
    });
    expect(h.store.snapshot()).toEqual({
      sessions: [],
      tokens: [],
      events: [],
    });
  });
});

describe("logout, refresh and bulk-revocation boundaries", () => {
  it("rotates bearer credentials without adding a browser CSRF field", async () => {
    const h = harness(createAuthCore);
    const issued = await h.login("alice-proof", bearer());
    const fresh = await h.core.refresh({
      token: issued.token,
      context: bearer(),
    });
    expect(fresh.csrfToken).toBeUndefined();
    expect(
      (await h.core.authenticate({ token: fresh.token, context: readBearer() }))
        .accountId,
    ).toBe("account-alice");
  });

  it("makes unknown logout idempotent and rejects cross-transport, expired and rotated logout", async () => {
    const h = harness(createAuthCore);
    expect(
      await h.core.logout({ token: "x".repeat(43), context: cookie() }),
    ).toEqual({ revoked: false });
    const issued = await h.login();
    await expect(
      h.core.logout({ token: issued.token, context: bearer() }),
    ).rejects.toMatchObject({ code: "session_denied" });
    h.setTime(10100);
    await expect(
      h.core.logout({
        token: issued.token,
        context: cookie({ csrf: issued.csrfToken }),
      }),
    ).rejects.toMatchObject({ code: "session_expired" });
    h.setTime(10000);
    const fresh = await h.core.refresh({
      token: issued.token,
      context: cookie({ csrf: issued.csrfToken }),
    });
    await expect(
      h.core.logout({
        token: issued.token,
        context: cookie({ csrf: issued.csrfToken }),
      }),
    ).rejects.toMatchObject({ code: "session_denied" });
    expect(
      await h.core.logout({
        token: fresh.token,
        context: cookie({ csrf: fresh.csrfToken }),
      }),
    ).toEqual({ revoked: true });
  });

  it("skips foreign and previously revoked rows returned by a faulty bulk-list port", async () => {
    const h = harness(createAuthCore);
    const issued = await h.login();
    const original = h.store;
    const guarded = createAuthCore({
      ...h.options,
      sessions: {
        transaction: (work) =>
          original.transaction((tx) =>
            work({
              ...tx,
              listSessions: async () => [
                {
                  ...original.snapshot().sessions[0],
                  accountId: "account-foreign",
                },
                { ...original.snapshot().sessions[0], namespace: "other-app" },
                { ...original.snapshot().sessions[0], revokedAt: 9999 },
              ],
            }),
          ),
      },
    });
    expect(await guarded.revokeAll("account-alice")).toEqual({ revoked: 0 });
    expect(
      (
        await h.core.authenticate({
          token: issued.token,
          context: readCookie(),
        })
      ).accountId,
    ).toBe("account-alice");
  });

  it("refuses revision overflow without changing the credential family", async () => {
    const h = harness(createAuthCore);
    const issued = await h.login();
    await h.store.transaction(async (tx) => {
      const row = await tx.getSession("app-one", issued.profile.sessionId);
      await tx.putSession({ ...row, revision: Number.MAX_SAFE_INTEGER });
    });
    const before = h.store.snapshot();
    await expect(
      h.core.refresh({
        token: issued.token,
        context: cookie({ csrf: issued.csrfToken }),
      }),
    ).rejects.toMatchObject({ code: "storage_unavailable" });
    expect(h.store.snapshot()).toEqual(before);
  });
});

const denies = (operation, code) =>
  assert.rejects(operation, (error) => error?.code === code);
const profileKeys = [
  "accountId",
  "authTime",
  "expiresAt",
  "issuer",
  "methods",
  "providerId",
  "sessionId",
  "subject",
];
const use = (h, issued, context = readCookie()) =>
  h.core.authenticate({ token: issued.token, context });
const refresh = (h, issued, changes = {}) =>
  h.core.refresh({
    token: issued.token,
    context: cookie({ csrf: issued.csrfToken, ...changes }),
  });

test("A01 AUTH-C01 invalid configuration is rejected", () => {
  const valid = harness(createAuthCore).options;
  for (const change of [
    { absoluteTtlMs: 0 },
    { idleTtlMs: -1 },
    { idleTtlMs: 1001 },
    { namespace: "" },
    { allowedOrigins: ["*"] },
    { allowedOrigins: ["https://app.example/path"] },
    { providers: null },
    { sessions: null },
    { now: null },
    { randomBytes: null },
  ]) {
    assert.throws(
      () => createAuthCore({ ...valid, ...change }),
      (error) => error?.code === "invalid_config",
    );
  }
});

test("A02 AUTH-C02 unknown provider and rejected proof create no session", async () => {
  const h = harness(createAuthCore);
  await denies(
    () =>
      h.core.login({
        providerId: "missing",
        proof: "alice-proof",
        context: cookie(),
      }),
    "authentication_denied",
  );
  await denies(() => h.login("unknown"), "authentication_denied");
  assert.equal(h.store.snapshot().sessions.length, 0);
});

test("A03 AUTH-C02 malformed claims fail before storage", async () => {
  const h = harness(createAuthCore);
  for (const proof of [
    { issuer: "", subject: "alice", authTime: 10000, methods: ["external"] },
    {
      issuer: "https://idp.example",
      subject: "",
      authTime: 10000,
      methods: ["external"],
    },
    {
      issuer: "https://idp.example",
      subject: "alice",
      authTime: 10001,
      methods: ["external"],
    },
    {
      issuer: "https://idp.example",
      subject: "alice",
      authTime: NaN,
      methods: [],
    },
  ]) {
    h.proofs.set("invalid-proof", proof);
    await denies(() => h.login("invalid-proof"), "authentication_denied");
  }
  assert.equal(h.store.snapshot().sessions.length, 0);
});

test("A04 AUTH-C02 provider failures expose no exception or secret", async () => {
  const h = harness(createAuthCore, {
    providers: new Map([
      [
        "external",
        async () => {
          throw Error("SECRET-PROVIDER-CREDENTIAL");
        },
      ],
    ]),
  });
  await denies(() => h.login(), "authentication_unavailable");
  assert.equal(
    JSON.stringify(h.events).includes("SECRET-PROVIDER-CREDENTIAL"),
    false,
  );
  assert.equal(h.store.snapshot().sessions.length, 0);
});

test("A05 AUTH-C03 resolver receives normalized identity only", async () => {
  const h = harness(createAuthCore);
  h.proofs.set("alice-proof", {
    ...h.proofs.get("alice-proof"),
    email: "secret@example.invalid",
    roles: ["owner"],
    hints: { administrator: true },
  });
  const issued = await h.login();
  assert.deepEqual(Object.keys(h.resolverCalls[0]).sort(), [
    "authTime",
    "issuer",
    "methods",
    "subject",
  ]);
  assert.deepEqual(Object.keys(issued.profile).sort(), profileKeys);
  assert.equal(issued.profile.accountId, "account-alice");
});

test("A06 AUTH-C03 same email on another issuer never links automatically", async () => {
  const h = harness(createAuthCore);
  h.proofs.set("foreign-proof", {
    issuer: "https://other-idp.example",
    subject: "alice",
    authTime: 10000,
    methods: ["external"],
    email: "alice@example.invalid",
  });
  await denies(() => h.login("foreign-proof"), "authentication_denied");
  assert.equal(h.store.snapshot().sessions.length, 0);
});

test("A07 AUTH-C03 browser input cannot select account or inject fields", async () => {
  const h = harness(createAuthCore);
  await denies(
    () =>
      h.core.login({
        providerId: "external",
        proof: "alice-proof",
        context: cookie(),
        accountId: "account-bob",
      }),
    "invalid_input",
  );
});

test("A08 AUTH-C04 tokens request cryptographic-width bytes; profiles are bounded", async () => {
  const h = harness(createAuthCore);
  const issued = await h.login();
  assert.match(issued.token, /^[A-Za-z0-9_-]{43,}$/);
  assert.match(issued.csrfToken, /^[A-Za-z0-9_-]{43,}$/);
  assert.notEqual(issued.token, issued.csrfToken);
  assert.ok(h.randomRequests.length >= 3);
  assert.ok(
    h.randomRequests.every((size) => Number.isSafeInteger(size) && size >= 32),
  );
  assert.deepEqual(Object.keys(issued.profile).sort(), profileKeys);
  assert.equal(issued.profile.expiresAt, 11000);
});

test("A09 AUTH-C04 repeated login creates distinct sessions and secrets", async () => {
  const h = harness(createAuthCore);
  const first = await h.login();
  const second = await h.login("alice-again");
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.profile.sessionId, second.profile.sessionId);
  assert.equal(h.store.snapshot().sessions.length, 2);
});

test("A10 AUTH-C05 storage and events retain digests, never raw credentials", async () => {
  const h = harness(createAuthCore);
  const issued = await h.login();
  const snapshot = h.store.snapshot();
  assert.equal(snapshot.tokens[0].tokenHash, digest(issued.token));
  assert.equal(snapshot.sessions[0].csrfHash, digest(issued.csrfToken));
  const fresh = await refresh(h, issued);
  const captured = JSON.stringify({
    snapshot: h.store.snapshot(),
    events: h.events,
  });
  for (const secret of [
    issued.token,
    fresh.token,
    issued.csrfToken,
    "alice-proof",
  ])
    assert.equal(captured.includes(secret), false);
});

test("A11 AUTH-C06 unknown token denies without state change", async () => {
  const h = harness(createAuthCore);
  const before = h.store.snapshot();
  await denies(
    () => h.core.authenticate({ token: "x".repeat(43), context: readCookie() }),
    "session_denied",
  );
  assert.deepEqual(h.store.snapshot(), before);
});

test("A12 AUTH-C06 AUTH-C09 cookie token cannot be replayed as bearer", async () => {
  const h = harness(createAuthCore);
  const issued = await h.login();
  await denies(() => use(h, issued, readBearer()), "session_denied");
  assert.equal((await use(h, issued)).accountId, "account-alice");
});

test("A13 AUTH-C06 shared storage does not merge application namespaces", async () => {
  const h = harness(createAuthCore);
  const issued = await h.login();
  const foreign = createAuthCore({ ...h.options, namespace: "app-two" });
  await denies(
    () => foreign.authenticate({ token: issued.token, context: readCookie() }),
    "session_denied",
  );
});

test("A14 AUTH-C07 idle expiry uses inclusive boundary", async () => {
  const h = harness(createAuthCore);
  const issued = await h.login();
  h.setTime(10100);
  await denies(() => use(h, issued), "session_expired");
});

test("A15 AUTH-C07 active use touches idle time but never absolute expiry", async () => {
  const h = harness(createAuthCore);
  const issued = await h.login();
  for (let time = 10090; time < 11000; time += 90) {
    h.setTime(time);
    assert.equal((await use(h, issued)).expiresAt, 11000);
  }
  h.setTime(11000);
  await denies(() => use(h, issued), "session_expired");
});

test("A16 AUTH-C07 invalid/backward clocks deny", async () => {
  for (const time of [9999, NaN, Infinity]) {
    const h = harness(createAuthCore);
    const issued = await h.login();
    h.setTime(time);
    await denies(() => use(h, issued), "session_expired");
  }
});

test("A17 AUTH-C08 unsafe cookie login needs exact origin and rejects cross-site", async () => {
  const h = harness(createAuthCore);
  for (const context of [
    cookie({ origin: undefined }),
    cookie({ origin: "https://app.example.evil.invalid" }),
    cookie({ secFetchSite: "cross-site" }),
  ]) {
    await denies(() => h.login("alice-proof", context), "csrf_denied");
  }
  assert.equal(h.store.snapshot().sessions.length, 0);
});

test("A18 AUTH-C08 cookie writes require session-bound CSRF and do not touch on denial", async () => {
  const h = harness(createAuthCore);
  const issued = await h.login();
  h.setTime(10050);
  const before = h.store.snapshot();
  await denies(() => use(h, issued, cookie()), "csrf_denied");
  await denies(() => use(h, issued, cookie({ csrf: "wrong" })), "csrf_denied");
  assert.deepEqual(h.store.snapshot(), before);
  assert.equal(
    (await use(h, issued, cookie({ csrf: issued.csrfToken }))).accountId,
    "account-alice",
  );
});

test("A19 AUTH-C08 safe methods cannot hide login/refresh/logout mutations", async () => {
  const h = harness(createAuthCore);
  await denies(() => h.login("alice-proof", readCookie()), "invalid_input");
  const issued = await h.login();
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    const input = {
      token: issued.token,
      context: readCookie({ method, csrf: issued.csrfToken }),
    };
    await denies(() => h.core.refresh(input), "invalid_input");
    await denies(() => h.core.logout(input), "invalid_input");
  }
});

test("A20 AUTH-C09 explicit bearer sessions work without cookie/CSRF assumptions", async () => {
  const h = harness(createAuthCore);
  const issued = await h.login("alice-proof", bearer());
  assert.equal(issued.csrfToken, undefined);
  assert.equal((await use(h, issued, readBearer())).accountId, "account-alice");
  await denies(() => use(h, issued, readCookie()), "session_denied");
});

test("A21 AUTH-C10 refresh rotates token and retains family/expiry/CSRF", async () => {
  const h = harness(createAuthCore);
  const old = await h.login();
  h.setTime(10050);
  const fresh = await refresh(h, old);
  assert.notEqual(fresh.token, old.token);
  assert.equal(fresh.profile.sessionId, old.profile.sessionId);
  assert.equal(fresh.profile.expiresAt, old.profile.expiresAt);
  assert.equal(fresh.csrfToken, old.csrfToken);
  await denies(() => use(h, old), "session_denied");
  assert.equal((await use(h, fresh)).accountId, "account-alice");
});

test("A22 AUTH-C11 refresh reuse revokes entire session family", async () => {
  const h = harness(createAuthCore);
  const old = await h.login();
  const fresh = await refresh(h, old);
  await denies(() => refresh(h, old), "session_reused");
  await denies(() => use(h, fresh), "session_denied");
});

test("A23 AUTH-C11 rejected stale refresh cannot revoke a live family", async () => {
  const h = harness(createAuthCore);
  const old = await h.login();
  const fresh = await refresh(h, old);
  await denies(
    () => refresh(h, old, { origin: "https://evil.invalid" }),
    "csrf_denied",
  );
  await denies(() => refresh(h, old, { csrf: "invalid" }), "csrf_denied");
  assert.equal((await use(h, fresh)).accountId, "account-alice");
});

test("A24 AUTH-C12 concurrent refresh never creates two live branches", async () => {
  const h = harness(createAuthCore);
  const old = await h.login();
  const results = await Promise.allSettled([refresh(h, old), refresh(h, old)]);
  const winners = results.filter((r) => r.status === "fulfilled");
  const losers = results.filter((r) => r.status === "rejected");
  assert.equal(winners.length, 1);
  assert.equal(losers.length, 1);
  assert.equal(losers[0].reason.code, "session_reused");
  await denies(() => use(h, winners[0].value), "session_denied");
});

test("A25 AUTH-C13 logout is immediate and idempotent", async () => {
  const h = harness(createAuthCore);
  const issued = await h.login();
  const input = {
    token: issued.token,
    context: cookie({ csrf: issued.csrfToken }),
  };
  assert.deepEqual(await h.core.logout(input), { revoked: true });
  assert.deepEqual(await h.core.logout(input), { revoked: false });
  await denies(() => use(h, issued), "session_denied");
});

test("A26 AUTH-C13 trusted host revokeAll is scoped to account and namespace", async () => {
  const h = harness(createAuthCore);
  const first = await h.login();
  const second = await h.login("alice-again");
  const bob = await h.login("bob-proof");
  const otherCore = createAuthCore({ ...h.options, namespace: "app-two" });
  const other = await otherCore.login({
    providerId: "external",
    proof: "alice-proof",
    context: cookie(),
  });
  assert.deepEqual(await h.core.revokeAll("account-alice"), { revoked: 2 });
  for (const issued of [first, second])
    await denies(() => use(h, issued), "session_denied");
  assert.equal((await use(h, bob)).accountId, "account-bob");
  assert.equal(
    (
      await otherCore.authenticate({
        token: other.token,
        context: readCookie(),
      })
    ).accountId,
    "account-alice",
  );
});

test("A27 AUTH-C14 storage failures never return a usable credential", async () => {
  const h = harness(createAuthCore);
  h.store.setUnavailable(true);
  await denies(() => h.login(), "storage_unavailable");
  assert.equal(h.events.length, 0);
  h.store.setUnavailable(false);
  assert.equal(h.store.snapshot().sessions.length, 0);
});

test("A28 AUTH-C14 returned identity cannot mutate later authenticated state", async () => {
  const h = harness(createAuthCore);
  const issued = await h.login();
  try {
    issued.profile.accountId = "account-bob";
    issued.profile.methods.push("owner");
  } catch {
    /* Frozen outputs are also valid. */
  }
  const actual = await use(h, issued);
  assert.equal(actual.accountId, "account-alice");
  assert.deepEqual(actual.methods, ["external"]);
});

test("A29 AUTH-C14 events have closed safe shape and match committed transitions", async () => {
  const h = harness(createAuthCore);
  const issued = await h.login();
  assert.equal(h.events.length, 1);
  assert.equal(h.events[0].kind, "session_created");
  const fresh = await refresh(h, issued);
  assert.equal(h.events.length, 2);
  assert.equal(h.events[1].kind, "session_refreshed");
  await h.core.logout({
    token: fresh.token,
    context: cookie({ csrf: fresh.csrfToken }),
  });
  assert.equal(h.events.length, 3);
  assert.equal(h.events[2].kind, "session_revoked");
  assert.equal(new Set(h.events.map((event) => event.eventId)).size, 3);
  assert.deepEqual(
    h.events.map((event) => event.revision),
    [1, 2, 3],
  );
  for (const event of h.events) {
    assert.deepEqual(
      Object.keys(event).sort(),
      [
        "eventId",
        "namespace",
        "kind",
        "at",
        "sessionId",
        "revision",
        "reason",
      ].sort(),
    );
    assert.equal(event.sessionId, issued.profile.sessionId);
    assert.equal(event.namespace, "app-one");
    assert.equal(typeof event.eventId, "string");
    assert.ok(event.eventId.length > 0);
    assert.equal(Number.isSafeInteger(event.revision), true);
    assert.equal(Number.isSafeInteger(event.at), true);
  }
});

test("A30 AUTH-C06 fresh shared-store revocation applies across core instances", async () => {
  const h = harness(createAuthCore);
  const issued = await h.login();
  await use(h, issued);
  await h.store.transaction(async (tx) => {
    const row = await tx.getSession("app-one", issued.profile.sessionId);
    await tx.putSession({ ...row, revokedAt: 10000 });
  });
  const other = createAuthCore(h.options);
  await denies(() => use(h, issued), "session_denied");
  await denies(
    () => other.authenticate({ token: issued.token, context: readCookie() }),
    "session_denied",
  );
});

test("A31 AUTH-C06 AUTH-C14 unavailable storage never authenticates cached state", async () => {
  const h = harness(createAuthCore);
  const issued = await h.login();
  await use(h, issued);
  h.store.setUnavailable(true);
  await denies(() => use(h, issued), "storage_unavailable");
});

test("A32 AUTH-C08 foreign-origin logout cannot revoke a current session", async () => {
  const h = harness(createAuthCore);
  const issued = await h.login();
  await denies(
    () =>
      h.core.logout({
        token: issued.token,
        context: cookie({
          origin: "https://evil.invalid",
          csrf: issued.csrfToken,
        }),
      }),
    "csrf_denied",
  );
  assert.equal((await use(h, issued)).accountId, "account-alice");
});

test("A33 AUTH-C04 broken randomness fails closed before any stored credential", async () => {
  const h = harness(createAuthCore, { randomBytes: () => new Uint8Array(4) });
  await denies(() => h.login(), "invalid_config");
  assert.equal(h.store.snapshot().sessions.length, 0);
  assert.equal(h.events.length, 0);
});

test("A34 AUTH-C14 outbox failure rolls back credentials and never loses a committed event", async () => {
  const h = harness(createAuthCore);
  h.store.setEventUnavailable(true);
  await denies(() => h.login(), "storage_unavailable");
  assert.deepEqual(h.store.snapshot(), {
    sessions: [],
    tokens: [],
    events: [],
  });
  h.store.setEventUnavailable(false);
  const issued = await h.login();
  const original = h.store.snapshot().events;
  assert.equal(original.length, 1);
  const before = h.store.snapshot();
  h.store.setEventUnavailable(true);
  await denies(() => refresh(h, issued), "storage_unavailable");
  await denies(
    () =>
      h.core.logout({
        token: issued.token,
        context: cookie({ csrf: issued.csrfToken }),
      }),
    "storage_unavailable",
  );
  assert.deepEqual(h.store.snapshot(), before);
  h.store.setEventUnavailable(false);
  const recreated = createAuthCore(h.options);
  await recreated.authenticate({ token: issued.token, context: readCookie() });
  assert.deepEqual(h.store.snapshot().events, original);
  assert.deepEqual(h.store.snapshot().events, original);
});

test("A35 AUTH-C04 session collision cannot overwrite another account", async () => {
  const h = harness(createAuthCore);
  const alice = await h.login();
  const before = h.store.snapshot();
  h.store.setSessionCollision(true);
  await denies(() => h.login("bob-proof"), "credential_collision");
  assert.deepEqual(h.store.snapshot(), before);
  h.store.setSessionCollision(false);
  assert.equal((await use(h, alice)).accountId, "account-alice");
});

test("A36 AUTH-C04 token collision cannot overwrite login or refresh credentials", async () => {
  const h = harness(createAuthCore);
  const alice = await h.login();
  const before = h.store.snapshot();
  h.store.setTokenCollision(true);
  await denies(() => h.login("bob-proof"), "credential_collision");
  await denies(() => refresh(h, alice), "credential_collision");
  assert.deepEqual(h.store.snapshot(), before);
  h.store.setTokenCollision(false);
  assert.equal((await use(h, alice)).accountId, "account-alice");
});

test("A37 AUTH-C04 repeated full-width secret material is refused without credential writes", async () => {
  const h = harness(createAuthCore, {
    randomBytes: (size) => new Uint8Array(size).fill(9),
  });
  await denies(() => h.login(), "credential_collision");
  assert.deepEqual(h.store.snapshot(), {
    sessions: [],
    tokens: [],
    events: [],
  });
});

test("A38 AUTH-C03 malformed/extra/accessor resolver results fail without getters", async () => {
  let getterCalls = 0;
  const getter = Object.defineProperty({}, "accountId", {
    enumerable: true,
    get() {
      getterCalls++;
      return "account-alice";
    },
  });
  for (const value of [
    {},
    [],
    { accountId: "" },
    { accountId: "account-alice", role: "owner" },
    getter,
  ]) {
    const h = harness(createAuthCore, { resolveIdentity: async () => value });
    await denies(() => h.login(), "authentication_denied");
    assert.equal(h.store.snapshot().sessions.length, 0);
  }
  assert.equal(getterCalls, 0);
});

test("A39 AUTH-C13 bulk revoke is atomic when a later outbox insert fails", async () => {
  const h = harness(createAuthCore);
  const first = await h.login();
  const second = await h.login("alice-again");
  const before = h.store.snapshot();
  h.store.setEventFailureAfter(1);
  await denies(() => h.core.revokeAll("account-alice"), "storage_unavailable");
  assert.deepEqual(h.store.snapshot(), before);
  h.store.setEventFailureAfter(null);
  assert.equal((await use(h, first)).accountId, "account-alice");
  assert.equal((await use(h, second)).accountId, "account-alice");
});

test("A40 AUTH-C04 repeated full-width material leaves existing credentials intact", async () => {
  const h = harness(createAuthCore);
  const alice = await h.login();
  const before = h.store.snapshot();
  const repeated = Buffer.from(alice.token, "base64url");
  const broken = createAuthCore({
    ...h.options,
    randomBytes: () => new Uint8Array(repeated),
  });
  await denies(
    () =>
      broken.login({
        providerId: "external",
        proof: "bob-proof",
        context: cookie(),
      }),
    "credential_collision",
  );
  await denies(
    () =>
      broken.refresh({
        token: alice.token,
        context: cookie({ csrf: alice.csrfToken }),
      }),
    "credential_collision",
  );
  assert.deepEqual(h.store.snapshot(), before);
  assert.equal((await use(h, alice)).accountId, "account-alice");
});

test("A41 AUTH-C14 duplicate event-ID result rolls back every lifecycle transition", async () => {
  const h = harness(createAuthCore);
  const alice = await h.login();
  const before = h.store.snapshot();
  h.store.setEventCollision(true);
  await denies(() => h.login("bob-proof"), "storage_unavailable");
  await denies(() => refresh(h, alice), "storage_unavailable");
  await denies(
    () =>
      h.core.logout({
        token: alice.token,
        context: cookie({ csrf: alice.csrfToken }),
      }),
    "storage_unavailable",
  );
  await denies(() => h.core.revokeAll("account-alice"), "storage_unavailable");
  assert.deepEqual(h.store.snapshot(), before);
  h.store.setEventCollision(false);
  assert.equal((await use(h, alice)).accountId, "account-alice");
});
