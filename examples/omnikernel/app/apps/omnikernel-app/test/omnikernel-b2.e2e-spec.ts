import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getDataSourceToken } from "@nestjs/typeorm";
import {
  collectOmniKernelQueryPlanEvidence,
  OmniRecordEntity,
  OmniRelationEntity,
} from "@nestjs-yalc/omnikernel-module";
import request from "supertest";
import type { DataSource } from "typeorm";
import {
  OmniKernelB2TestAppModule,
  type OmniKernelB2Dialect,
} from "../src/omni/omnikernel-b2-test-app";

const dialect = (process.env.OMNIKERNEL_B2_DIALECT ??
  "sqlite") as OmniKernelB2Dialect;

const scopeAlpha = "scope-alpha";
const scopeBravo = "scope-bravo";

const authenticated = (scopeId: string) => ({
  Authorization: `Bearer omnikernel-b2:${scopeId}`,
});

const gql = (
  app: INestApplication,
  scopeId: string,
  query: string,
  variables?: Record<string, unknown>,
) =>
  request(app.getHttpServer())
    .post("/graphql")
    .set(authenticated(scopeId))
    .send({ query, variables });

describe(`OmniKernel B2 generated API parity (${dialect})`, () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        OmniKernelB2TestAppModule.register({
          dialect,
          postgresUrl: process.env.OMNIKERNEL_B2_POSTGRES_URL,
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("uses the authenticated server scope for generated REST records", async () => {
    const alphaOnlyGuid = "10000000-0000-4000-8000-000000000001";
    const created = await request(app.getHttpServer())
      .post("/omni/records")
      .set(authenticated(scopeAlpha))
      .send({
        guid: alphaOnlyGuid,
        title: "Alpha record",
        kind: "generic",
        status: "active",
        payload: { nested: { value: "alpha" } },
        payloadSchemaId: "example.record",
        payloadSchemaVersion: 1,
      })
      .expect(201);

    expect(created.body).toMatchObject({
      guid: alphaOnlyGuid,
      title: "Alpha record",
      revision: 1,
      payloadSchemaId: "example.record",
      payloadSchemaVersion: 1,
    });
    expect(created.body.scopeId).toBeUndefined();

    await request(app.getHttpServer())
      .get(`/omni/records/${alphaOnlyGuid}`)
      .set(authenticated(scopeBravo))
      .expect(404);

    const sharedGuid = "10000000-0000-4000-8000-000000000002";
    await request(app.getHttpServer())
      .post("/omni/records")
      .set(authenticated(scopeAlpha))
      .send({
        guid: sharedGuid,
        title: "Shared alpha record",
        kind: "generic",
        status: "active",
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/omni/records")
      .set(authenticated(scopeBravo))
      .send({
        guid: sharedGuid,
        title: "Shared bravo record",
        kind: "generic",
        status: "active",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/omni/records/${sharedGuid}`)
      .set(authenticated(scopeBravo))
      .expect(200)
      .expect(({ body }) => {
        expect(body.title).toBe("Shared bravo record");
        expect(body.scopeId).toBeUndefined();
      });
  });

  it("runs generated REST CRUD for every public Omni resource", async () => {
    const namedGuid = "10000000-0000-4000-8000-000000000010";
    const recordGuid = "10000000-0000-4000-8000-000000000011";
    const collectionGuid = "10000000-0000-4000-8000-000000000012";
    const documentGuid = "10000000-0000-4000-8000-000000000013";
    const relationGuid = "10000000-0000-4000-8000-000000000014";
    const externalRefGuid = "10000000-0000-4000-8000-000000000015";

    await request(app.getHttpServer())
      .post("/omni/named")
      .set(authenticated(scopeAlpha))
      .send({ guid: namedGuid, title: "Named alpha", slug: "named-alpha" })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/omni/named/${namedGuid}`)
      .set(authenticated(scopeAlpha))
      .send({ title: "Named alpha updated" })
      .expect(200)
      .expect(({ body }) => expect(body.title).toBe("Named alpha updated"));
    await request(app.getHttpServer())
      .get(`/omni/named/${namedGuid}`)
      .set(authenticated(scopeAlpha))
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/omni/named/${namedGuid}`)
      .set(authenticated(scopeAlpha))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/omni/named/${namedGuid}`)
      .set(authenticated(scopeAlpha))
      .expect(404);

    await request(app.getHttpServer())
      .post("/omni/records")
      .set(authenticated(scopeAlpha))
      .send({
        guid: recordGuid,
        title: "Record alpha",
        kind: "generic",
        status: "active",
        payload: { retained: "value" },
      })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/omni/records/${recordGuid}`)
      .set(authenticated(scopeAlpha))
      .send({ title: "Record alpha updated", payload: { retained: "updated" } })
      .expect(200)
      .expect(({ body }) => {
        expect(body.title).toBe("Record alpha updated");
        expect(body.payload).toEqual({ retained: "updated" });
      });
    await request(app.getHttpServer())
      .get(`/omni/records/${recordGuid}`)
      .set(authenticated(scopeAlpha))
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/omni/records/${recordGuid}`)
      .set(authenticated(scopeAlpha))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/omni/records/${recordGuid}`)
      .set(authenticated(scopeAlpha))
      .expect(404);

    await request(app.getHttpServer())
      .post("/omni/collections")
      .set(authenticated(scopeAlpha))
      .send({
        guid: collectionGuid,
        title: "Collection alpha",
        collectionKind: "folder",
        status: "active",
      })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/omni/collections/${collectionGuid}`)
      .set(authenticated(scopeAlpha))
      .send({ summary: "Updated collection" })
      .expect(200)
      .expect(({ body }) => expect(body.summary).toBe("Updated collection"));
    await request(app.getHttpServer())
      .get(`/omni/collections/${collectionGuid}`)
      .set(authenticated(scopeAlpha))
      .expect(200);

    await request(app.getHttpServer())
      .post("/omni/documents")
      .set(authenticated(scopeAlpha))
      .send({
        guid: documentGuid,
        title: "Document alpha",
        documentKind: "note",
        status: "active",
        content: "First version",
      })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/omni/documents/${documentGuid}`)
      .set(authenticated(scopeAlpha))
      .send({ content: "Updated document" })
      .expect(200)
      .expect(({ body }) => expect(body.content).toBe("Updated document"));
    await request(app.getHttpServer())
      .get(`/omni/documents/${documentGuid}`)
      .set(authenticated(scopeAlpha))
      .expect(200);

    await request(app.getHttpServer())
      .post("/omni/relations")
      .set(authenticated(scopeAlpha))
      .send({
        guid: relationGuid,
        sourceRecordId: collectionGuid,
        targetRecordId: documentGuid,
        kind: "contains",
        status: "active",
        payload: { rank: 1 },
        payloadSchemaId: "example.relation",
        payloadSchemaVersion: 1,
      })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/omni/relations/${relationGuid}`)
      .set(authenticated(scopeAlpha))
      .send({ status: "archived", payload: { rank: 2 } })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("archived");
        expect(body.payload).toEqual({ rank: 2 });
      });
    await request(app.getHttpServer())
      .get(`/omni/relations/${relationGuid}`)
      .set(authenticated(scopeAlpha))
      .expect(200);

    await request(app.getHttpServer())
      .post("/omni/external-refs")
      .set(authenticated(scopeAlpha))
      .send({
        guid: externalRefGuid,
        internalType: "document",
        internalId: documentGuid,
        provider: "github",
        account: "acme",
        container: "notes",
        externalId: "ext-1",
        payload: { mirrored: true },
        payloadSchemaId: "example.external-ref",
        payloadSchemaVersion: 1,
      })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/omni/external-refs/${externalRefGuid}`)
      .set(authenticated(scopeAlpha))
      .send({ payload: { mirrored: false } })
      .expect(200)
      .expect(({ body }) => expect(body.payload).toEqual({ mirrored: false }));
    await request(app.getHttpServer())
      .get(`/omni/external-refs/${externalRefGuid}`)
      .set(authenticated(scopeAlpha))
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/omni/relations/${relationGuid}`)
      .set(authenticated(scopeAlpha))
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/omni/external-refs/${externalRefGuid}`)
      .set(authenticated(scopeAlpha))
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/omni/documents/${documentGuid}`)
      .set(authenticated(scopeAlpha))
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/omni/collections/${collectionGuid}`)
      .set(authenticated(scopeAlpha))
      .expect(200);

    for (const path of [
      `/omni/relations/${relationGuid}`,
      `/omni/external-refs/${externalRefGuid}`,
      `/omni/documents/${documentGuid}`,
      `/omni/collections/${collectionGuid}`,
    ]) {
      await request(app.getHttpServer())
        .get(path)
        .set(authenticated(scopeAlpha))
        .expect(404);
    }
  });

  it("rejects unsafe JSON and cross-scope relation or reference access", async () => {
    const alphaSourceGuid = "10000000-0000-4000-8000-000000000020";
    const alphaTargetGuid = "10000000-0000-4000-8000-000000000021";
    const bravoTargetGuid = "10000000-0000-4000-8000-000000000022";
    const customRelationGuid = "10000000-0000-4000-8000-000000000023";
    const alphaReferenceGuid = "10000000-0000-4000-8000-000000000024";
    const bravoReferenceGuid = "10000000-0000-4000-8000-000000000025";

    await request(app.getHttpServer())
      .post("/omni/records")
      .set(authenticated(scopeAlpha))
      .send({
        guid: "10000000-0000-4000-8000-000000000026",
        title: "Client selected scope",
        kind: "generic",
        status: "active",
        scopeId: scopeBravo,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post("/omni/records")
      .set(authenticated(scopeAlpha))
      .send({
        guid: "10000000-0000-4000-8000-000000000027",
        title: "Invalid payload",
        kind: "generic",
        status: "active",
        payload: [],
      })
      .expect(400);
    await request(app.getHttpServer())
      .post("/omni/records")
      .set(authenticated(scopeAlpha))
      .send({
        guid: "10000000-0000-4000-8000-000000000028",
        title: "Incomplete payload schema",
        kind: "generic",
        status: "active",
        payloadSchemaId: "example.record",
      })
      .expect(400);

    for (const [scopeId, guid, title] of [
      [scopeAlpha, alphaSourceGuid, "Alpha source"],
      [scopeAlpha, alphaTargetGuid, "Alpha target"],
      [scopeBravo, bravoTargetGuid, "Bravo target"],
    ] as const) {
      await request(app.getHttpServer())
        .post("/omni/records")
        .set(authenticated(scopeId))
        .send({ guid, title, kind: "generic", status: "active" })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post("/omni/relations")
      .set(authenticated(scopeAlpha))
      .send({
        guid: "10000000-0000-4000-8000-000000000029",
        sourceRecordId: alphaSourceGuid,
        targetRecordId: bravoTargetGuid,
        kind: "references",
        status: "active",
      })
      .expect(404);
    await request(app.getHttpServer())
      .post("/omni/relations")
      .set(authenticated(scopeAlpha))
      .send({
        guid: "10000000-0000-4000-8000-000000000030",
        sourceRecordId: alphaSourceGuid,
        targetRecordId: alphaTargetGuid,
        kind: "unexpected",
        status: "active",
      })
      .expect(400);
    await request(app.getHttpServer())
      .post("/omni/relations")
      .set(authenticated(scopeAlpha))
      .send({
        guid: customRelationGuid,
        sourceRecordId: alphaSourceGuid,
        targetRecordId: alphaTargetGuid,
        kind: "blocks",
        status: "active",
      })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/omni/relations/${customRelationGuid}`)
      .set(authenticated(scopeBravo))
      .expect(404);
    await request(app.getHttpServer())
      .put(`/omni/relations/${customRelationGuid}`)
      .set(authenticated(scopeAlpha))
      .send({ targetRecordId: alphaSourceGuid })
      .expect(400);

    const externalIdentity = {
      internalType: "document",
      internalId: alphaTargetGuid,
      provider: "github",
      account: "acme",
      container: "b2",
      externalId: "same-external-id",
    };
    await request(app.getHttpServer())
      .post("/omni/external-refs")
      .set(authenticated(scopeAlpha))
      .send({ guid: alphaReferenceGuid, ...externalIdentity })
      .expect(201);
    await request(app.getHttpServer())
      .post("/omni/external-refs")
      .set(authenticated(scopeAlpha))
      .send({
        guid: "10000000-0000-4000-8000-000000000031",
        ...externalIdentity,
      })
      .expect(409);
    await request(app.getHttpServer())
      .post("/omni/external-refs")
      .set(authenticated(scopeBravo))
      .send({ guid: bravoReferenceGuid, ...externalIdentity })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/omni/external-refs/${alphaReferenceGuid}`)
      .set(authenticated(scopeBravo))
      .expect(404);
  });

  it("keeps generated GraphQL CRUD and relation loading on the same scope", async () => {
    const sourceGuid = "10000000-0000-4000-8000-000000000040";
    const targetGuid = "10000000-0000-4000-8000-000000000041";
    const relationGuid = "10000000-0000-4000-8000-000000000042";

    const schema = await gql(
      app,
      scopeAlpha,
      "{ __schema { mutationType { fields { name } } } }",
    ).expect(200);
    const mutationNames = schema.body.data.__schema.mutationType.fields.map(
      (field: { name: string }) => field.name,
    );
    for (const entity of [
      "OmniNamedEntity",
      "OmniRecordEntity",
      "OmniCollectionEntity",
      "OmniDocumentEntity",
      "OmniRelationEntity",
      "OmniExternalRefEntity",
    ]) {
      expect(mutationNames).toEqual(
        expect.arrayContaining([
          `OmniKernel_create${entity}`,
          `OmniKernel_update${entity}`,
          `OmniKernel_delete${entity}`,
        ]),
      );
    }

    const created = await gql(
      app,
      scopeAlpha,
      `mutation CreateRecord($input: OmniRecordCreateInput!) {
        OmniKernel_createOmniRecordEntity(input: $input) {
          guid title revision payload payloadSchemaId payloadSchemaVersion
        }
      }`,
      {
        input: {
          guid: sourceGuid,
          title: "GraphQL source",
          kind: "generic",
          status: "Active",
          payload: { channel: "graphql" },
          payloadSchemaId: "example.graphql",
          payloadSchemaVersion: 1,
        },
      },
    );
    expect(created.status).toBe(200);
    expect(created.body.errors).toBeUndefined();
    expect(created.body.data.OmniKernel_createOmniRecordEntity).toMatchObject({
      guid: sourceGuid,
      revision: 1,
      payload: { channel: "graphql" },
    });

    await request(app.getHttpServer())
      .post("/omni/records")
      .set(authenticated(scopeAlpha))
      .send({
        guid: targetGuid,
        title: "GraphQL target",
        kind: "generic",
        status: "active",
      })
      .expect(201);
    await request(app.getHttpServer())
      .post("/omni/relations")
      .set(authenticated(scopeAlpha))
      .send({
        guid: relationGuid,
        sourceRecordId: sourceGuid,
        targetRecordId: targetGuid,
        kind: "references",
        status: "active",
      })
      .expect(201);

    const grid = await gql(
      app,
      scopeAlpha,
      `query {
        OmniKernel_getOmniRecordEntityGrid {
          nodes { guid title outgoingRelations { guid kind targetRecordId } }
          pageData { count }
        }
      }`,
    ).expect(200);
    expect(grid.body.errors).toBeUndefined();
    expect(grid.body.data.OmniKernel_getOmniRecordEntityGrid.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guid: sourceGuid,
          outgoingRelations: [
            expect.objectContaining({ guid: relationGuid, kind: "references" }),
          ],
        }),
      ]),
    );

    const updated = await gql(
      app,
      scopeAlpha,
      `mutation UpdateRecord(
        $conditions: OmniRecordCondition!
        $input: OmniRecordUpdateInput!
      ) {
        OmniKernel_updateOmniRecordEntity(conditions: $conditions, input: $input) {
          guid title payload revision
        }
      }`,
      {
        conditions: { guid: sourceGuid },
        input: {
          title: "GraphQL source updated",
          payload: { channel: "updated" },
        },
      },
    ).expect(200);
    expect(updated.body.errors).toBeUndefined();
    expect(updated.body.data.OmniKernel_updateOmniRecordEntity).toMatchObject({
      guid: sourceGuid,
      title: "GraphQL source updated",
      payload: { channel: "updated" },
    });

    const deleted = await gql(
      app,
      scopeAlpha,
      `mutation DeleteRecord($conditions: OmniRecordCondition!) {
        OmniKernel_deleteOmniRecordEntity(conditions: $conditions)
      }`,
      { conditions: { guid: sourceGuid } },
    ).expect(200);
    expect(deleted.body).toEqual({
      data: { OmniKernel_deleteOmniRecordEntity: true },
    });

    const denied = await gql(
      app,
      scopeBravo,
      `query { OmniKernel_getOmniRecordEntityGrid { nodes { guid } } }`,
    ).expect(200);
    expect(denied.body.errors).toBeUndefined();
    expect(
      denied.body.data.OmniKernel_getOmniRecordEntityGrid.nodes,
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ guid: sourceGuid })]),
    );
  });

  it("selects the declared scoped indexes in a bounded final-schema probe", async () => {
    const dataSource = app.get<DataSource>(getDataSourceToken());
    const recordRepository = dataSource.getRepository(OmniRecordEntity);
    const relationRepository = dataSource.getRepository(OmniRelationEntity);
    const sourceGuid = "20000000-0000-4000-8000-000000000001";
    const alphaRecords = Array.from({ length: 1_000 }, (_, index) => ({
      scopeId: scopeAlpha,
      guid: `20000000-0000-4000-8001-${String(index).padStart(12, "0")}`,
      title: `Alpha diagnostic ${index}`,
      kind: "noise",
      status: "draft",
    }));
    const bravoRecords = Array.from({ length: 1_000 }, (_, index) => ({
      scopeId: scopeBravo,
      guid: `20000000-0000-4000-8002-${String(index).padStart(12, "0")}`,
      title: `Bravo diagnostic ${index}`,
      kind: "noise",
      status: "draft",
    }));

    const diagnosticRecords = [
      ...alphaRecords,
      ...bravoRecords,
      {
        scopeId: scopeAlpha,
        guid: sourceGuid,
        title: "Diagnostic needle",
        kind: "needle",
        status: "active",
      },
    ];
    const diagnosticRelations = [
      {
        scopeId: scopeAlpha,
        guid: "30000000-0000-4000-8000-000000000001",
        sourceRecordId: sourceGuid,
        targetRecordId: alphaRecords[0].guid,
        kind: "references",
        status: "active",
      },
      ...alphaRecords.map((target, index) => ({
        scopeId: scopeAlpha,
        guid: `30000000-0000-4000-8001-${String(index).padStart(12, "0")}`,
        sourceRecordId: alphaRecords[0].guid,
        targetRecordId: target.guid,
        kind: "references",
        status: "active",
      })),
    ];
    for (let index = 0; index < diagnosticRecords.length; index += 200) {
      await recordRepository.insert(
        recordRepository.create(diagnosticRecords.slice(index, index + 200)),
      );
    }
    for (let index = 0; index < diagnosticRelations.length; index += 200) {
      await relationRepository.insert(
        relationRepository.create(
          diagnosticRelations.slice(index, index + 200),
        ),
      );
    }
    await dataSource.query("ANALYZE");

    const evidence = await collectOmniKernelQueryPlanEvidence(dataSource, {
      scopeId: scopeAlpha,
      recordKind: "needle",
      recordStatus: "active",
      sourceRecordId: sourceGuid,
      relationKind: "references",
      relationStatus: "active",
    });

    expect(evidence.dialect).toBe(dialect);
    expect(evidence.usesRecordGridIndex).toBe(true);
    expect(evidence.usesRelationSourceIndex).toBe(true);
  });
});
