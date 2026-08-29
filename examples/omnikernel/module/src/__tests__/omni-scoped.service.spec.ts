import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { DataSource } from "typeorm";

const { OmniNamedEntity } = await import("../base/omni-named.entity.js");
const { OmniRecordEntity } = await import("../base/omni-record.entity.js");
const { OmniRelationEntity } = await import("../base/omni-relation.entity.js");
const { OmniExternalRefEntity } =
  await import("../base/omni-external-ref.entity.js");
const { OmniRecordStatus } = await import("../omni-record-status.enum.js");
const { OmniRelationStatus } = await import("../omni-relation-status.enum.js");
const { OmniExternalRefInternalType } =
  await import("../omni-external-ref-internal-type.enum.js");
const { createOmniRelationKindContract } =
  await import("../omni-relation-kind.contract.js");
const { OmniRelationService } = await import("../omni-relation.service.js");
const { OmniExternalRefService } =
  await import("../omni-external-ref.service.js");
const { OmniScopedService } = await import("../omni-scoped.service.js");

const alphaScope = {
  scopeId: "scope-alpha",
  cacheKey: (key: string) => `scope-alpha:${key}`,
};
const bravoScope = {
  scopeId: "scope-bravo",
  cacheKey: (key: string) => `scope-bravo:${key}`,
};

describe("OmniScopedService", () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: "sqlite",
      database: ":memory:",
      dropSchema: true,
      synchronize: true,
      entities: [
        OmniNamedEntity,
        OmniRecordEntity,
        OmniRelationEntity,
        OmniExternalRefEntity,
      ],
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it("enforces scope, payload metadata, scoped reads, and tombstones", async () => {
    const repository = dataSource.getRepository(OmniRecordEntity);
    const alpha = new OmniScopedService(
      repository as never,
      alphaScope,
      "tombstone",
    );
    const bravo = new OmniScopedService(
      repository as never,
      bravoScope,
      "tombstone",
    );
    const sharedGuid = "a0000000-0000-4000-8000-000000000001";

    await expect(
      alpha.createEntity({
        guid: sharedGuid,
        title: "attempted scope override",
        kind: "generic",
        status: OmniRecordStatus.Active,
        scopeId: "scope-bravo",
      } as never),
    ).rejects.toThrow("server-owned");
    await expect(
      alpha.createEntity({
        guid: sharedGuid,
        title: "invalid payload",
        kind: "generic",
        status: OmniRecordStatus.Active,
        payload: ["not-an-object"],
      }),
    ).rejects.toThrow("payload must be");
    await expect(
      alpha.createEntity({
        guid: sharedGuid,
        title: "partial schema",
        kind: "generic",
        status: OmniRecordStatus.Active,
        payloadSchemaId: "example.record",
      }),
    ).rejects.toThrow("supplied together");

    await alpha.createEntity({
      guid: sharedGuid,
      title: "alpha record",
      kind: "generic",
      status: OmniRecordStatus.Active,
      payload: { nested: true },
      payloadSchemaId: "example.record",
      payloadSchemaVersion: 1,
    });
    await bravo.createEntity({
      guid: sharedGuid,
      title: "bravo record",
      kind: "generic",
      status: OmniRecordStatus.Active,
    });

    expect((await alpha.getEntity({ guid: sharedGuid }))?.title).toBe(
      "alpha record",
    );
    expect((await bravo.getEntity({ guid: sharedGuid }))?.title).toBe(
      "bravo record",
    );
    expect(await alpha.getEntityListExtended({})).toHaveLength(1);

    await expect(
      alpha.updateEntity(
        { guid: sharedGuid },
        { guid: "a0000000-0000-4000-8000-000000000099" },
      ),
    ).rejects.toThrow("guid is immutable");
    await alpha.updateEntity(
      { guid: sharedGuid },
      { title: "alpha record updated" },
    );
    await alpha.deleteEntity({ guid: sharedGuid });

    await expect(
      alpha.getEntity({ guid: sharedGuid }, undefined, undefined, undefined, {
        failOnNull: true,
      }),
    ).rejects.toThrow("not found");
    expect((await bravo.getEntity({ guid: sharedGuid }))?.title).toBe(
      "bravo record",
    );
    await expect(alpha.getEntity("guid = ?" as never)).rejects.toThrow(
      "String where clauses",
    );
  });

  it("validates scoped relation endpoints and the extensible kind contract", async () => {
    const recordRepository = dataSource.getRepository(OmniRecordEntity);
    const relationRepository = dataSource.getRepository(OmniRelationEntity);
    const records = new OmniScopedService(
      recordRepository as never,
      alphaScope,
      "tombstone",
    );
    const bravoRecords = new OmniScopedService(
      recordRepository as never,
      bravoScope,
      "tombstone",
    );
    const sourceId = "a0000000-0000-4000-8000-000000000010";
    const targetId = "a0000000-0000-4000-8000-000000000011";
    const bravoOnlyId = "a0000000-0000-4000-8000-000000000012";

    await records.createEntity({
      guid: sourceId,
      title: "source",
      kind: "generic",
      status: OmniRecordStatus.Active,
    });
    await records.createEntity({
      guid: targetId,
      title: "target",
      kind: "generic",
      status: OmniRecordStatus.Active,
    });
    await bravoRecords.createEntity({
      guid: bravoOnlyId,
      title: "bravo target",
      kind: "generic",
      status: OmniRecordStatus.Active,
    });

    const relations = new OmniRelationService(
      relationRepository as never,
      alphaScope,
      "hard",
      recordRepository,
      createOmniRelationKindContract(["blocks"]),
    );
    const relationId = "a0000000-0000-4000-8000-000000000013";

    await relations.createEntity({
      guid: relationId,
      sourceRecordId: sourceId,
      targetRecordId: targetId,
      kind: "blocks",
      status: OmniRelationStatus.Active,
    });
    await expect(
      relations.createEntity({
        guid: "a0000000-0000-4000-8000-000000000014",
        sourceRecordId: sourceId,
        targetRecordId: bravoOnlyId,
        kind: "blocks",
        status: OmniRelationStatus.Active,
      }),
    ).rejects.toThrow("not found");
    await expect(
      relations.createEntity({
        guid: "a0000000-0000-4000-8000-000000000015",
        sourceRecordId: sourceId,
        targetRecordId: targetId,
        kind: "unregistered",
        status: OmniRelationStatus.Active,
      }),
    ).rejects.toThrow("not registered");
    await expect(
      relations.createEntity({
        guid: "a0000000-0000-4000-8000-000000000016",
        sourceRecordId: sourceId,
        targetRecordId: targetId,
        kind: "contains",
        status: OmniRelationStatus.Active,
      }),
    ).rejects.toThrow("not valid for these endpoint kinds");
    await expect(
      relations.updateEntity(
        { guid: relationId },
        { sourceRecordId: targetId },
      ),
    ).rejects.toThrow("immutable");

    await relations.updateEntity(
      { guid: relationId },
      { status: OmniRelationStatus.Inactive },
    );
    expect((await relations.getEntity({ guid: relationId }))?.status).toBe(
      OmniRelationStatus.Inactive,
    );
  });

  it("keeps external identities unique within scope while normalizing null partitions", async () => {
    const repository = dataSource.getRepository(OmniExternalRefEntity);
    const alpha = new OmniExternalRefService(
      repository as never,
      alphaScope,
      "hard",
    );
    const bravo = new OmniExternalRefService(
      repository as never,
      bravoScope,
      "hard",
    );
    const input = {
      guid: "a0000000-0000-4000-8000-000000000020",
      provider: "github",
      externalId: "42",
      internalType: OmniExternalRefInternalType.Document,
      internalId: "document-42",
      account: null,
      container: null,
    };

    await alpha.createEntity(input);
    expect(
      await alpha.findByExternalIdentity({
        provider: "github",
        externalId: "42",
      }),
    ).toEqual(
      expect.objectContaining({ guid: input.guid, account: "", container: "" }),
    );
    await expect(
      alpha.createEntity({
        ...input,
        guid: "a0000000-0000-4000-8000-000000000021",
      }),
    ).rejects.toThrow("already exists");
    await bravo.createEntity({
      ...input,
      guid: "a0000000-0000-4000-8000-000000000022",
    });
    expect(
      await alpha.findForInternalRecord(
        OmniExternalRefInternalType.Document,
        "document-42",
      ),
    ).toHaveLength(1);
  });
});
