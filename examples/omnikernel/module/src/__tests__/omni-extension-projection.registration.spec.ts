import { Scope, type INestApplication } from '@nestjs/common';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphQLModule, GraphQLSchemaHost } from '@nestjs/graphql';
import { ModuleRef } from '@nestjs/core';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  createProjectionDialect,
  CrudGenResourceFactory,
} from "@nestjs-yalc/crud-gen";
import { EventModule } from '@nestjs-yalc/event-manager';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar.js';
import request from 'supertest';
import { DataSource } from "typeorm";
import type { OmniMigrationRunner } from '../omni-migration.js';

const { OmniNamedEntity } = await import("../base/omni-named.entity.js");
const { OmniRecordEntity } = await import("../base/omni-record.entity.js");
const { OmniRelationEntity } = await import("../base/omni-relation.entity.js");
const { OmniExternalRefEntity } =
  await import("../base/omni-external-ref.entity.js");
const { OmniCollectionEntity } = await import("../omni-collection.entity.js");
const { OmniDocumentEntity } = await import("../omni-document.entity.js");
const { OmniRecordStatus } = await import("../omni-record-status.enum.js");
const { OmniKernelModule } = await import('../omnikernel.module.js');
const {
  OmniRecordCondition,
  OmniRecordCreateInput,
  OmniRecordType,
  OmniRecordUpdateInput,
} = await import('../omni-record.dto.js');
const {
  createOmniExtensionProjectionEntity,
  defineOmniExtensionProjection,
} = await import("../omni-extension-projection.definition.js");
const { createOmniExtensionProjectionRegistration } =
  await import("../omni-extension-projection.resource.js");
const { defineOmniRelationProjection } = await import(
  '../omni-relation-projection.definition.js'
);
const { createOmniRelationProjectionRegistration } = await import(
  '../omni-relation-projection.resource.js'
);
const {
  captureOmniMigrationSnapshot,
  createOmniMigrationPlan,
  defineOmniMigrationSnapshot,
} = await import("../omni-migration.js");
const { createOmniProjectionReaderCatalogProvider } = await import(
  '../omni-projection.catalog.js'
);

type ExtensionRow = {
  scopeId: string;
  guid: string;
  label: string;
  payload: Record<string, unknown>;
};

class ExampleExtensionApi {
  guid!: string;
  label!: string;
  enabled!: boolean;
  revision!: number;
  payload!: Record<string, unknown>;
}

class ExampleLinkApi {
  guid!: string;
  sourceRecordId!: string;
  targetRecordId!: string;
  revision!: number;
  payload!: Record<string, unknown>;
}

const rawRecordResource = CrudGenResourceFactory<typeof OmniRecordEntity>({
  entityModel: OmniRecordEntity,
  backend: false,
  graphql: {
    resolver: {
      dto: OmniRecordType,
      input: {
        create: OmniRecordCreateInput,
        update: OmniRecordUpdateInput,
        conditions: OmniRecordCondition,
      },
      prefix: 'Raw_',
    },
  },
  rest: {
    dto: OmniRecordType,
    path: 'raw-records',
    idField: 'guid',
  },
});

const definition = defineOmniExtensionProjection({
  id: "example.nest-extension.v1",
  tableName: "example-nest-extension",
  identity: { column: "guid", uniqueWithinScope: true },
  scope: { column: "scopeId", serverOwned: true },
  revision: { column: "revision" },
  payload: { column: "payload", allowCreate: true },
  deletion: "hard",
  fields: [
    {
      name: "guid",
      storage: "column",
      column: "guid",
      codec: "uuid",
      nullable: false,
      requiredOnCreate: true,
    },
    {
      name: "label",
      storage: "column",
      column: "label",
      codec: "string",
      nullable: false,
      requiredOnCreate: true,
      query: { filter: ["eq"], sort: true },
    },
    {
      name: "enabled",
      storage: "json",
      path: ["state", "enabled"],
      codec: "boolean",
      nullable: false,
      requiredOnCreate: true,
      index: { name: "example_nest_extension_enabled_idx" },
      query: { filter: ["eq"], sort: true },
    },
  ],
  owner: {
    kind: "example_nest_extension",
    title: "Example Nest extension",
    status: OmniRecordStatus.Active,
    schema: { id: "example.nest-extension.v1", version: 1 },
  },
});

const relationDefinition = defineOmniRelationProjection({
  id: 'example.nest-extension-link.v1',
  relation: {
    allowedKinds: ['example_link', 'example_blocks'],
    sourceKind: definition.owner.kind,
    targetKind: definition.owner.kind,
    schema: { id: 'example.nest-extension-link.v1', version: 1 },
  },
  aliases: {
    kind: 'linkKind',
    source: 'sourceWorkItemId',
    target: 'targetWorkItemId',
    payload: 'metadata',
  },
});

const scope = {
  scopeId: "scope-registration",
  cacheKey: (key: string) => `scope-registration:${key}`,
};

const events = {
  errorBadRequest: (_event: string, options: any) =>
    new ConflictException(options.response.message),
  errorConflict: (_event: string, options: any) =>
    new ConflictException(options.response.message),
  errorNotFound: (_event: string, options: any) =>
    new NotFoundException(options.response.message),
};

const lifecycleToken = Symbol('example-projection-lifecycle');
const catalogToken = Symbol('example-projection-catalog');
const moduleRefToken = Symbol('example-consumer-module-ref');
const lifecycleBeforeCreate = jest.fn();
const lifecycleBeforeUpdate = jest.fn();
const lifecycleBeforeDelete = jest.fn();

const postgresUrl = process.env.OMNI_EXTENSION_PROJECTION_POSTGRES_URL;
const dialectCases: Array<{ name: "sqlite" | "postgres"; url?: string }> = [
  { name: "sqlite" },
  ...(postgresUrl ? [{ name: "postgres" as const, url: postgresUrl }] : []),
];

describe("Omni extension projection registration", () => {
  it("returns generated CrudGen REST and GraphQL surfaces with request-scoped providers", () => {
    const entity = createOmniExtensionProjectionEntity<ExtensionRow>(
      definition,
      createProjectionDialect("sqlite"),
    );
    const registration = createOmniExtensionProjectionRegistration({
      entity,
      apiModel: ExampleExtensionApi,
      definition,
      dbConnection: "default",
      rest: { path: "example-extensions" },
    });

    expect(Object.isFrozen(registration)).toBe(true);
    expect(registration.definition).toBe(definition);
    expect(registration.entities).toEqual([entity]);
    expect(registration.reservedRecordKinds).toEqual([definition.owner.kind]);
    expect(registration.controllers).toHaveLength(1);
    expect(registration.resource.providers).toHaveLength(1);
    expect(registration.providers).toHaveLength(3);
    expect(
      registration.providers.filter(
        (provider) =>
          typeof provider === 'object' &&
          provider !== null &&
          'provide' in provider &&
          provider.provide === registration.serviceToken,
      ),
    ).toHaveLength(1);
    expect(
      registration.providers.filter(
        (provider) =>
          typeof provider === 'object' &&
          provider !== null &&
          'provide' in provider &&
          provider.provide === registration.dataLoaderToken,
      ),
    ).toHaveLength(1);

    const relationRegistration = createOmniRelationProjectionRegistration({
      apiModel: ExampleLinkApi,
      definition: relationDefinition,
      dbConnection: 'default',
      rest: { path: 'example-links' },
    });
    expect(Object.isFrozen(relationRegistration)).toBe(true);
    expect(relationRegistration.entities).toEqual([]);
    expect(relationRegistration.relationKinds).toEqual([
      'example_link',
      'example_blocks',
    ]);
    expect(relationRegistration.controllers).toHaveLength(1);
    expect(relationRegistration.providers).toHaveLength(3);
  });
});

describe('Omni extension projection generated transport', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const restGuid = '10000000-0000-4000-8000-000000000201';
  const graphqlGuid = '10000000-0000-4000-8000-000000000202';
  const relationGuid = '10000000-0000-4000-8000-000000000206';
  const normalRecordGuid = '10000000-0000-4000-8000-000000000203';
  const rejectedRecordGuid = '10000000-0000-4000-8000-000000000204';

  beforeAll(async () => {
    const entity = createOmniExtensionProjectionEntity<ExtensionRow>(
      definition,
      createProjectionDialect('sqlite'),
    );
    const registration = createOmniExtensionProjectionRegistration({
      entity,
      apiModel: ExampleExtensionApi,
      definition,
      dbConnection: 'default',
      catalog: { token: catalogToken },
      lifecycle: { token: lifecycleToken },
      moduleRefToken,
      rest: { path: 'example-extensions' },
      graphql: {
        names: {
          object: 'TransportExampleExtensionApi',
          create: 'TransportExampleExtensionApiCreateInput',
          patch: 'TransportExampleExtensionApiUpdateInput',
          conditions: 'TransportExampleExtensionApiCondition',
        },
      },
    });
    const relationRegistration = createOmniRelationProjectionRegistration({
      apiModel: ExampleLinkApi,
      definition: relationDefinition,
      dbConnection: 'default',
      catalog: { token: catalogToken },
      lifecycle: { token: lifecycleToken },
      moduleRefToken,
      rest: { path: 'example-links' },
      graphql: {
        names: {
          object: 'TransportExampleLinkApi',
          create: 'TransportExampleLinkApiCreateInput',
          patch: 'TransportExampleLinkApiUpdateInput',
          conditions: 'TransportExampleLinkApiCondition',
        },
      },
    });
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          path: '/graphql',
        }),
        EventEmitterModule.forRoot(),
        EventModule.forRootAsync(),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          synchronize: false,
          autoLoadEntities: true,
        }),
        OmniKernelModule.register({
          dbConnection: 'default',
          defaultScopeId: scope.scopeId,
          reservedRecordKinds: registration.reservedRecordKinds,
          relationKinds: relationRegistration.relationKinds,
        }),
        TypeOrmModule.forFeature(registration.entities),
      ],
      controllers: [
        ...registration.controllers,
        ...relationRegistration.controllers,
        ...rawRecordResource.controllers,
      ],
      providers: [
        UUIDScalar,
        { provide: moduleRefToken, useExisting: ModuleRef },
        createOmniProjectionReaderCatalogProvider(
          [registration, relationRegistration],
          catalogToken,
        ),
        {
          provide: lifecycleToken,
          scope: Scope.REQUEST,
          useFactory: () => ({
            beforeCreate: async (context: any) => {
              lifecycleBeforeCreate(context);
              await context.readers.extension(definition.id).list({
                where: { label: '__missing__' },
                take: 1,
              });
            },
            beforeUpdate: async (context: any) => {
              lifecycleBeforeUpdate(context);
            },
            beforeDelete: async (context: any) => {
              lifecycleBeforeDelete(context);
            },
          }),
        },
        ...registration.providers,
        ...relationRegistration.providers,
        ...rawRecordResource.providers,
      ],
    }).compile();

    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    const snapshot = captureOmniMigrationSnapshot(
      'example-nest-extension-transport-v1',
      dataSource,
      [registration],
    );
    const migration = createOmniMigrationPlan(snapshot);
    const queryRunner = dataSource.createQueryRunner();
    const migrationRunner: OmniMigrationRunner = queryRunner;
    await queryRunner.connect();
    try {
      await migration.create(migrationRunner);
    } finally {
      await queryRunner.release();
    }

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('boots with EventModule, a consumer ModuleRef token, and generated CRUD', async () => {
    const schema = app.get(GraphQLSchemaHost).schema;
    const queryFields = Object.keys(schema.getQueryType()!.getFields());
    const mutationFields = Object.keys(schema.getMutationType()!.getFields());
    expect(queryFields).toEqual(
      expect.arrayContaining([
        'getExampleExtensionApi',
        'getExampleExtensionApiGrid',
        'getExampleLinkApi',
        'getExampleLinkApiGrid',
      ]),
    );
    expect(mutationFields).toEqual(
      expect.arrayContaining([
        'createExampleExtensionApi',
        'updateExampleExtensionApi',
        'deleteExampleExtensionApi',
        'createExampleLinkApi',
        'updateExampleLinkApi',
        'deleteExampleLinkApi',
      ]),
    );

    await request(app.getHttpServer())
      .post('/example-extensions')
      .send({ guid: restGuid, label: 'REST extension', enabled: true })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          guid: restGuid,
          label: 'REST extension',
          enabled: true,
          revision: 1,
        });
      });

    await request(app.getHttpServer())
      .get(`/example-extensions/${restGuid}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.enabled).toBe(true);
      });
    await request(app.getHttpServer())
      .get('/example-extensions')
      .expect(200)
      .expect(({ body }) => {
        expect(body.list).toEqual(
          expect.arrayContaining([expect.objectContaining({ guid: restGuid })]),
        );
      });
    await request(app.getHttpServer())
      .put(`/example-extensions/${restGuid}`)
      .send({ label: 'REST extension patched', enabled: false, expectedRevision: 1 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          guid: restGuid,
          label: 'REST extension patched',
          enabled: false,
          revision: 2,
        });
      });

    const graphCreate = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `mutation CreateExample($input: TransportExampleExtensionApiCreateInput!) {
          createExampleExtensionApi(input: $input) { guid label enabled revision }
        }`,
        variables: {
          input: {
            guid: graphqlGuid,
            label: 'GraphQL extension',
            enabled: true,
          },
        },
      })
      .expect(200);
    expect(graphCreate.body.errors).toBeUndefined();
    expect(graphCreate.body.data.createExampleExtensionApi).toMatchObject({
      guid: graphqlGuid,
      enabled: true,
      revision: 1,
    });

    await request(app.getHttpServer())
      .post('/example-links')
      .send({
        guid: relationGuid,
        linkKind: 'example_link',
        sourceWorkItemId: restGuid,
        targetWorkItemId: graphqlGuid,
        metadata: { origin: 'generated REST' },
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          guid: relationGuid,
          linkKind: 'example_link',
          sourceWorkItemId: restGuid,
          targetWorkItemId: graphqlGuid,
          metadata: { origin: 'generated REST' },
        });
        expect(body.kind).toBeUndefined();
        expect(body.status).toBeUndefined();
      });

    const graphRead = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `query {
          getExampleExtensionApi(guid: "${restGuid}") { guid label enabled revision }
          getExampleExtensionApiGrid { nodes { guid label enabled } pageData { count } }
        }`,
      })
      .expect(200);
    expect(graphRead.body.errors).toBeUndefined();
    expect(graphRead.body.data.getExampleExtensionApi).toMatchObject({
      guid: restGuid,
      enabled: false,
      revision: 2,
    });
    expect(graphRead.body.data.getExampleExtensionApiGrid.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ guid: restGuid }),
        expect.objectContaining({ guid: graphqlGuid }),
      ]),
    );

    const graphRelation = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `query {
          getExampleLinkApi(guid: "${relationGuid}") {
            guid linkKind sourceWorkItemId targetWorkItemId metadata
          }
          getExampleLinkApiGrid { nodes { guid } pageData { count } }
        }`,
      })
      .expect(200);
    expect(graphRelation.body.errors).toBeUndefined();
    expect(graphRelation.body.data.getExampleLinkApi).toMatchObject({
      guid: relationGuid,
      linkKind: 'example_link',
      sourceWorkItemId: restGuid,
      targetWorkItemId: graphqlGuid,
    });
    expect(graphRelation.body.data.getExampleLinkApiGrid.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ guid: relationGuid })]),
    );

    const graphRelationUpdate = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `mutation UpdateLink(
          $conditions: TransportExampleLinkApiCondition!
          $input: TransportExampleLinkApiUpdateInput!
        ) {
          updateExampleLinkApi(conditions: $conditions, input: $input) {
            guid metadata revision
          }
        }`,
        variables: {
          conditions: { guid: relationGuid },
          input: {
            metadata: { origin: 'generated GraphQL' },
            expectedRevision: 1,
          },
        },
      })
      .expect(200);
    expect(graphRelationUpdate.body.errors).toBeUndefined();
    expect(graphRelationUpdate.body.data.updateExampleLinkApi).toMatchObject({
      guid: relationGuid,
      metadata: { origin: 'generated GraphQL' },
    });

    const graphUpdate = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `mutation UpdateExample(
          $conditions: TransportExampleExtensionApiCondition!
          $input: TransportExampleExtensionApiUpdateInput!
        ) {
          updateExampleExtensionApi(conditions: $conditions, input: $input) {
            guid label enabled revision
          }
        }`,
        variables: {
          conditions: { guid: graphqlGuid },
          input: { label: 'GraphQL extension patched', enabled: false, expectedRevision: 1 },
        },
      })
      .expect(200);
    expect(graphUpdate.body.errors).toBeUndefined();
    expect(graphUpdate.body.data.updateExampleExtensionApi).toMatchObject({
      guid: graphqlGuid,
      enabled: false,
      revision: 2,
    });

    await request(app.getHttpServer())
      .post('/raw-records')
      .send({
        guid: rejectedRecordGuid,
        title: 'attempted owner',
        kind: definition.owner.kind,
        status: OmniRecordStatus.Active,
        payloadSchemaId: definition.owner.schema.id,
        payloadSchemaVersion: definition.owner.schema.version,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/raw-records')
      .send({
        guid: normalRecordGuid,
        title: 'normal record',
        kind: 'normal_record',
        status: OmniRecordStatus.Active,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/example-links')
      .send({
        guid: '10000000-0000-4000-8000-000000000207',
        linkKind: 'example_link',
        sourceWorkItemId: normalRecordGuid,
        targetWorkItemId: graphqlGuid,
      })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/raw-records/${normalRecordGuid}`)
      .send({ kind: definition.owner.kind })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/raw-records/${restGuid}`)
      .send({ kind: 'normal_record' })
      .expect(400);
    await request(app.getHttpServer())
      .delete(`/raw-records/${restGuid}`)
      .expect(400);

    for (const requestBody of [
      {
        query: `mutation CreateRaw($input: OmniRecordCreateInput!) {
          Raw_createOmniRecordEntity(input: $input) { guid }
        }`,
        variables: {
          input: {
            guid: '10000000-0000-4000-8000-000000000205',
            title: 'attempted GraphQL owner',
            kind: definition.owner.kind,
            status: 'Active',
          },
        },
      },
      {
        query: `mutation UpdateRaw(
          $conditions: OmniRecordCondition!
          $input: OmniRecordUpdateInput!
        ) {
          Raw_updateOmniRecordEntity(conditions: $conditions, input: $input) { guid }
        }`,
        variables: {
          conditions: { guid: restGuid },
          input: { kind: 'normal_record' },
        },
      },
      {
        query: `mutation DeleteRaw($conditions: OmniRecordCondition!) {
          Raw_deleteOmniRecordEntity(conditions: $conditions)
        }`,
        variables: { conditions: { guid: restGuid } },
      },
    ]) {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send(requestBody);
      expect([200, 400]).toContain(response.status);
      expect(response.body.data ?? null).toBeNull();
      expect(response.body.errors?.[0]?.message ?? response.body.message).toContain(
        'owned by a registered extension projection',
      );
    }

    const graphRelationDelete = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `mutation DeleteLink($conditions: TransportExampleLinkApiCondition!) {
          deleteExampleLinkApi(conditions: $conditions)
        }`,
        variables: { conditions: { guid: relationGuid } },
      })
      .expect(200);
    expect(graphRelationDelete.body.errors).toBeUndefined();
    expect(graphRelationDelete.body.data.deleteExampleLinkApi).toBe(true);

    const graphDelete = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `mutation DeleteExample($conditions: TransportExampleExtensionApiCondition!) {
          deleteExampleExtensionApi(conditions: $conditions)
        }`,
        variables: { conditions: { guid: graphqlGuid } },
      })
      .expect(200);
    expect(graphDelete.body.errors).toBeUndefined();
    expect(graphDelete.body.data.deleteExampleExtensionApi).toBe(true);

    await request(app.getHttpServer())
      .delete(`/example-extensions/${restGuid}`)
      .expect(200)
      .expect({ deleted: true });
    expect(
      await dataSource.getRepository(OmniRecordEntity).findOneBy({
        scopeId: scope.scopeId,
        guid: restGuid,
      }),
    ).toBeNull();
    expect(lifecycleBeforeCreate).toHaveBeenCalledTimes(3);
    expect(lifecycleBeforeUpdate).toHaveBeenCalledTimes(3);
    expect(lifecycleBeforeDelete).toHaveBeenCalledTimes(3);
  });
});

describe('Omni migration snapshot ordering', () => {
  it('orders referenced extension tables independently of snapshot order', () => {
    const parent = {
      name: 'projection_parent',
      columns: [],
    };
    const child = {
      name: 'projection_child',
      columns: [],
      foreignKeys: [
        {
          name: 'projection_child_parent_fk',
          columnNames: ['scopeId', 'parentGuid'],
          referencedTableName: 'projection_parent',
          referencedColumnNames: ['scopeId', 'guid'],
          onDelete: 'RESTRICT' as const,
        },
      ],
    };
    const plan = createOmniMigrationPlan(
      defineOmniMigrationSnapshot({
        version: 'projection-order-v1',
        dialect: 'sqlite',
        tables: [child, parent],
        indexStatements: [],
      }),
    );

    expect(plan.tableNames).toEqual(['projection_parent', 'projection_child']);
    expect(() =>
      createOmniMigrationPlan(
        defineOmniMigrationSnapshot({
          version: 'projection-order-cycle-v1',
          dialect: 'sqlite',
          tables: [
            child,
            {
              ...parent,
              foreignKeys: [
                {
                  name: 'projection_parent_child_fk',
                  columnNames: ['scopeId', 'childGuid'],
                  referencedTableName: 'projection_child',
                  referencedColumnNames: ['scopeId', 'guid'],
                  onDelete: 'RESTRICT',
                },
              ],
            },
          ],
          indexStatements: [],
        }),
      ),
    ).toThrow('cross-table foreign-key cycle');
  });
});

describe.each(dialectCases)(
  "Omni migration plan (%s)",
  ({ name, url }) => {
    let dataSource: DataSource;

    afterEach(async () => {
      if (dataSource?.isInitialized) await dataSource.destroy();
    });

    it("uses a frozen metadata snapshot to create Omni base and extension tables without synchronize", async () => {
      const entity = createOmniExtensionProjectionEntity<ExtensionRow>(
        definition,
        createProjectionDialect(name),
      );
      const registration = createOmniExtensionProjectionRegistration({
        entity,
        apiModel: ExampleExtensionApi,
        definition,
        dbConnection: "default",
      });
      dataSource = new DataSource({
        type: name,
        ...(name === "sqlite"
          ? { database: ":memory:" }
          : { url: url!, ssl: false }),
        synchronize: false,
        entities: [
          OmniNamedEntity,
          OmniRecordEntity,
          OmniDocumentEntity,
          OmniCollectionEntity,
          OmniRelationEntity,
          OmniExternalRefEntity,
          ...registration.entities,
        ],
      });
      await dataSource.initialize();
      if (name === "postgres") await dataSource.dropDatabase();

      const captured = captureOmniMigrationSnapshot(
        `example-nest-extension-${name}-v1`,
        dataSource,
        [registration],
      );
      const migrationSource = structuredClone(captured);
      const plan = createOmniMigrationPlan(
        defineOmniMigrationSnapshot(migrationSource),
      );
      expect(dataSource.options.synchronize).toBe(false);
      expect(Object.isFrozen(plan)).toBe(true);
      expect(Object.isFrozen(plan.tableNames)).toBe(true);
      expect(Object.isFrozen(plan.indexStatements)).toBe(true);
      expect(Object.isFrozen(captured)).toBe(true);
      expect(Object.isFrozen(captured.tables)).toBe(true);
      expect(Object.isFrozen(captured.indexStatements)).toBe(true);
      expect(plan.tableNames).toEqual(
        expect.arrayContaining([
          "omni-named",
          "omni-record",
          "omni-relation",
          "omni-external-ref",
          definition.tableName,
        ]),
      );
      const shuffledPlan = createOmniMigrationPlan(
        defineOmniMigrationSnapshot({
          ...captured,
          tables: [...captured.tables].reverse(),
        }),
      );
      expect(
        shuffledPlan.tableNames.indexOf('omni-record'),
      ).toBeLessThan(shuffledPlan.tableNames.indexOf(definition.tableName));

      const firstSnapshot = plan.createTables();
      firstSnapshot[0].name = "mutated-copy";
      migrationSource.tables[0].name = "mutated-migration-source";
      migrationSource.indexStatements[0] = "mutated-index-statement";
      expect(plan.createTables()[0].name).not.toBe("mutated-copy");
      expect(plan.createTables()[0].name).not.toBe(
        "mutated-migration-source",
      );
      expect(plan.indexStatements[0]).not.toBe("mutated-index-statement");
      const enabledIndex = definition.fields.find(
        (field) => field.name === "enabled",
      )!.index!.name;
      expect(plan.indexStatements).toEqual(
        expect.arrayContaining([
          expect.stringContaining(`CREATE INDEX "${enabledIndex}"`),
        ]),
      );

      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      try {
        await plan.create(queryRunner);
      } finally {
        await queryRunner.release();
      }

      const verificationRunner = dataSource.createQueryRunner();
      await verificationRunner.connect();
      try {
        expect(await verificationRunner.hasTable(definition.tableName)).toBe(
          true,
        );
      } finally {
        await verificationRunner.release();
      }
      const extensionTable = plan
        .createTables()
        .find((table) => table.name === definition.tableName)!;
      expect(extensionTable.foreignKeys).toEqual([
        expect.objectContaining({
          columnNames: ["scopeId", "guid"],
          referencedTableName: "omni-record",
          referencedColumnNames: ["scopeId", "guid"],
          onDelete: "CASCADE",
        }),
      ]);
      expect(extensionTable.findColumnByName("payload")?.type).toBe(
        name === "postgres" ? "jsonb" : "text",
      );

      const serviceProvider = registration.providers.find(
        (provider) =>
          typeof provider === "object" &&
          provider !== null &&
          "provide" in provider &&
          provider.provide === registration.serviceToken,
      ) as any;
      const service = serviceProvider.useFactory(dataSource, scope, events);
      await service.createEntity({
        guid: "10000000-0000-4000-8000-000000000101",
        label: "migration-owned",
        enabled: true,
      });
      expect(
        await dataSource.getRepository(OmniRecordEntity).countBy({
          scopeId: scope.scopeId,
          guid: "10000000-0000-4000-8000-000000000101",
        }),
      ).toBe(1);

      const projectionDialect = createProjectionDialect(name);
      const evidence = await projectionDialect.inspect(dataSource, definition);
      expect(evidence.indexes).toContain(enabledIndex);
      const indexStatement = plan.indexStatements.find((statement) =>
        statement.includes(`CREATE INDEX "${enabledIndex}"`),
      )!;
      const prefix = `CREATE INDEX "${enabledIndex}" ON "${definition.tableName}" ("scopeId", `;
      const suffix = `, "${definition.identity.column}")`;
      expect(indexStatement.startsWith(prefix)).toBe(true);
      expect(indexStatement.endsWith(suffix)).toBe(true);
      const expression = indexStatement.slice(prefix.length, -suffix.length);
      const planRunner = dataSource.createQueryRunner();
      await planRunner.connect();
      try {
        if (name === "postgres") {
          await planRunner.startTransaction();
          await planRunner.query("SET LOCAL enable_seqscan = off");
          const rows = await planRunner.query(
            `EXPLAIN (COSTS OFF) SELECT "${definition.identity.column}" FROM "${definition.tableName}" WHERE "${definition.scope.column}" = $1 AND ${expression} = $2 ORDER BY "${definition.identity.column}" ASC`,
            [scope.scopeId, true],
          );
          expect(JSON.stringify(rows)).toContain(enabledIndex);
        } else {
          const rows = await planRunner.query(
            `EXPLAIN QUERY PLAN SELECT "${definition.identity.column}" FROM "${definition.tableName}" INDEXED BY "${enabledIndex}" WHERE "${definition.scope.column}" = ? AND ${expression} = ? ORDER BY "${definition.identity.column}" ASC`,
            [scope.scopeId, 1],
          );
          expect(JSON.stringify(rows)).toContain(enabledIndex);
        }
      } finally {
        if (planRunner.isTransactionActive) await planRunner.rollbackTransaction();
        await planRunner.release();
      }

      const downRunner = dataSource.createQueryRunner();
      await downRunner.connect();
      try {
        await plan.drop(downRunner);
        expect(await downRunner.hasTable(definition.tableName)).toBe(false);
        expect(await downRunner.hasTable('omni-record')).toBe(false);
        await plan.create(downRunner);
        expect(await downRunner.hasTable(definition.tableName)).toBe(true);
        expect(await downRunner.hasTable('omni-record')).toBe(true);
      } finally {
        await downRunner.release();
      }
    });
  },
);
