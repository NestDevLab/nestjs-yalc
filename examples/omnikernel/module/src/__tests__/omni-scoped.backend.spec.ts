import { describe, expect, it } from "@jest/globals";
import { EventEmitter2 } from "@nestjs/event-emitter";

const { OmniNamedEntity } = await import("../base/omni-named.entity.js");
const { OmniRecordEntity } = await import("../base/omni-record.entity.js");
const { OmniRelationEntity } = await import("../base/omni-relation.entity.js");
const { OmniCollectionEntity } = await import("../omni-collection.entity.js");
const { OmniDocumentEntity } = await import("../omni-document.entity.js");
const { OmniExternalRefEntity } =
  await import("../base/omni-external-ref.entity.js");
const { OmniExternalRefService } =
  await import("../omni-external-ref.service.js");
const { OmniRelationService } = await import("../omni-relation.service.js");
const { OmniScopedService } = await import("../omni-scoped.service.js");
const { normalizeOmniKernelRegistrationOptions } =
  await import("../omni-scope.js");
const { omniScopedBackendProvidersFactory, omniBackendServiceToken } =
  await import("../omni-scoped.backend.js");
const { omniNamedBackendProvidersFactory } =
  await import("../omni-named.backend.js");
const { omniRecordBackendProvidersFactory } =
  await import("../omni-record.backend.js");
const { omniRelationBackendProvidersFactory } =
  await import("../omni-relation.backend.js");
const { omniCollectionBackendProvidersFactory } =
  await import("../omni-collection.backend.js");
const { omniDocumentBackendProvidersFactory } =
  await import("../omni-document.backend.js");
const { omniExternalRefBackendProvidersFactory } =
  await import("../omni-external-ref.backend.js");

const scope = {
  scopeId: "scope-alpha",
  cacheKey: (key: string) => `scope-alpha:${key}`,
};
const options = normalizeOmniKernelRegistrationOptions({
  dbConnection: "default",
  relationKinds: ["blocks"],
});

const repositoryFor = (target: unknown) => ({ target });

const factoryProvider = (providers: unknown[]) =>
  providers.find(
    (provider) =>
      typeof provider === "object" &&
      provider !== null &&
      "useFactory" in provider,
  ) as { useFactory: (...dependencies: unknown[]) => unknown };

describe("Omni scoped backend providers", () => {
  it("builds request-scoped generic services for every ordinary resource", () => {
    const cases = [
      [omniNamedBackendProvidersFactory, OmniNamedEntity],
      [omniRecordBackendProvidersFactory, OmniRecordEntity],
      [omniCollectionBackendProvidersFactory, OmniCollectionEntity],
      [omniDocumentBackendProvidersFactory, OmniDocumentEntity],
    ] as const;

    for (const [factory, entity] of cases) {
      const backend = factory("default");
      const service = factoryProvider(backend.providers).useFactory(
        repositoryFor(entity),
        scope,
        options,
      );
      expect(service).toBeInstanceOf(OmniScopedService);
    }
  });

  it("builds the relation service with a scoped record dependency", () => {
    const backend = omniRelationBackendProvidersFactory("default");
    const service = factoryProvider(backend.providers).useFactory(
      repositoryFor(OmniRelationEntity),
      scope,
      options,
      repositoryFor(OmniRecordEntity),
    );

    expect(service).toBeInstanceOf(OmniRelationService);
  });

  it("builds the external-reference service and exposes its service alias", () => {
    const backend = omniExternalRefBackendProvidersFactory("default");
    const service = factoryProvider(backend.providers).useFactory(
      repositoryFor(OmniExternalRefEntity),
      scope,
      options,
    );

    expect(service).toBeInstanceOf(OmniExternalRefService);
    expect(backend.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provide: OmniExternalRefService }),
      ]),
    );
    expect(omniBackendServiceToken(OmniExternalRefService)).toBe(
      "OmniExternalRefService",
    );
  });

  it("uses the scope-prefixed cache key in the generated request loader", () => {
    const backend = omniScopedBackendProvidersFactory({
      entityModel: OmniRecordEntity,
      dbConnection: "default",
      createService: (repository, resolvedScope) =>
        new OmniScopedService(repository, resolvedScope),
    });
    const loaderProvider = backend.providers.find(
      (provider) =>
        typeof provider === "object" &&
        provider !== null &&
        "useFactory" in provider &&
        provider !== factoryProvider(backend.providers),
    ) as { useFactory: (...dependencies: unknown[]) => unknown };
    const service = new OmniScopedService(
      repositoryFor(OmniRecordEntity) as never,
      scope,
    );

    expect(
      loaderProvider.useFactory(service, scope, new EventEmitter2()),
    ).toBeDefined();
  });
});
