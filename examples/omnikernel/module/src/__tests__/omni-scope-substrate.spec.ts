import { describe, expect, it, jest } from "@jest/globals";

const { canonicalOmniRelationKinds, createOmniRelationKindContract } =
  await import("../omni-relation-kind.contract.js");
const { normalizeOmniKernelRegistrationOptions, OmniScopeContext } =
  await import("../omni-scope.js");
const { OmniScopedRepository } = await import("../omni-scoped.repository.js");

describe("Omni scoped substrate", () => {
  it("derives a trusted scope, scopes cache keys, and rejects invalid registration", () => {
    const options = normalizeOmniKernelRegistrationOptions({
      dbConnection: "default",
      defaultScopeId: "fallback",
      resolveScope: (request) =>
        (request as { authenticatedScope?: string }).authenticatedScope,
      relationKinds: ["blocks"],
      deletion: { record: "tombstone" },
    });
    const scope = new OmniScopeContext(
      { req: { authenticatedScope: "scope-alpha" } },
      options,
    );

    expect(scope.scopeId).toBe("scope-alpha");
    expect(scope.cacheKey("record-1")).toBe("scope-alpha:record-1");
    expect(options.deletion.document).toBe("tombstone");
    expect(() => new OmniScopeContext({ req: {} }, options)).toThrow(
      "unavailable",
    );
    expect(() =>
      normalizeOmniKernelRegistrationOptions({
        dbConnection: "",
      }),
    ).toThrow("database connection");
    expect(() =>
      normalizeOmniKernelRegistrationOptions({
        dbConnection: "default",
        deletion: { record: "erase" as never },
      }),
    ).toThrow("must be hard or tombstone");
    expect(() =>
      normalizeOmniKernelRegistrationOptions({
        dbConnection: "default",
        deletion: { records: "tombstone" } as never,
      }),
    ).toThrow("Unknown OmniKernel deletion policy resource");
  });

  it("keeps canonical relation kinds stable while validating registered extensions", () => {
    const contract = createOmniRelationKindContract(["blocks"]);

    expect(canonicalOmniRelationKinds).toContain("contains");
    expect(contract.has("blocks")).toBe(true);
    expect(() => contract.assert("unknown")).toThrow("not registered");
    expect(() => createOmniRelationKindContract(["not portable!"])).toThrow(
      "lowercase letters",
    );
  });

  it("adds scope to lower-level repository queries and refuses caller scope input", async () => {
    const repository = {
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
    };
    const scoped = new OmniScopedRepository(repository as never, {
      scopeId: "scope-alpha",
      cacheKey: (key: string) => key,
    });

    await scoped.findOneByGuid("record-1");
    await scoped.find({ title: "Scoped record" } as never);

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { guid: "record-1", scopeId: "scope-alpha" },
    });
    expect(repository.find).toHaveBeenCalledWith({
      where: { title: "Scoped record", scopeId: "scope-alpha" },
    });
    expect(() => scoped.where({ scopeId: "scope-bravo" } as never)).toThrow(
      "derived from server context",
    );
  });
});
