import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  applyProjectionIndexesForBootstrap,
  createProjectionDialect,
  type ProjectionDialect,
} from "@nestjs-yalc/crud-gen";
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from "typeorm";

const { OmniNamedEntity } = await import("../base/omni-named.entity.js");
const { OmniRecordEntity } = await import("../base/omni-record.entity.js");
const { OmniRelationEntity } = await import("../base/omni-relation.entity.js");
const { OmniExternalRefEntity } =
  await import("../base/omni-external-ref.entity.js");
const { OmniExtensionProjectionService } =
  await import("../omni-extension-projection.service.js");
const {
  createOmniExtensionProjectionEntity,
  defineOmniExtensionProjection,
} = await import("../omni-extension-projection.definition.js");
const { OmniExternalRefBindingValidator } =
  await import("../omni-external-ref-binding.validator.js");
const { OmniExternalRefService } =
  await import("../omni-external-ref.service.js");
const { OmniExternalRefInternalType } =
  await import("../omni-external-ref-internal-type.enum.js");
const { defineOmniRelationProjection } =
  await import("../omni-relation-projection.definition.js");
const { OmniRelationProjectionService } =
  await import("../omni-relation-projection.service.js");
const { createOmniRelationKindContract } =
  await import("../omni-relation-kind.contract.js");
const { createOmniProjectionReaderCatalog } =
  await import("../omni-projection.catalog.js");
const { OmniRecordStatus } = await import("../omni-record-status.enum.js");

type ExtensionRow = {
  scopeId: string;
  guid: string;
  label: string;
  payload: Record<string, unknown>;
  revision?: number;
  priority?: number | null;
};

const definition = defineOmniExtensionProjection({
  id: "example.extension-projection.v1",
  tableName: "example-extension-projection",
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
      name: "priority",
      storage: "json",
      path: ["attributes", "priority"],
      codec: "integer",
      nullable: true,
      query: { filter: ["eq", "range"], sort: true },
      index: { name: "example_extension_projection_priority_idx" },
    },
    {
      name: "enabled",
      storage: "json",
      path: ["attributes", "enabled"],
      codec: "boolean",
      nullable: false,
      requiredOnCreate: true,
      query: { filter: ["eq"], sort: true },
      index: { name: "example_extension_projection_enabled_idx" },
    },
  ],
  owner: {
    kind: "example_extension",
    title: "Example extension",
    status: OmniRecordStatus.Active,
    schema: { id: "example.extension.v1", version: 1 },
  },
});

const relationDefinition = defineOmniRelationProjection({
  id: "example.extension-link.v1",
  relation: {
    kind: "links",
    sourceKind: definition.owner.kind,
    targetKind: definition.owner.kind,
    schema: { id: "example.extension-link.v1", version: 1 },
  },
});

const alphaScope = {
  scopeId: "scope-alpha",
  cacheKey: (key: string) => `scope-alpha:${key}`,
};
const bravoScope = {
  scopeId: "scope-bravo",
  cacheKey: (key: string) => `scope-bravo:${key}`,
};

const firstGuid = "10000000-0000-4000-8000-000000000001";
const secondGuid = "10000000-0000-4000-8000-000000000002";
const thirdGuid = "10000000-0000-4000-8000-000000000003";
const bravoOnlyGuid = "10000000-0000-4000-8000-000000000004";

const events = {
  errorBadRequest: (_event: string, options: any) =>
    new BadRequestException(options.response.message),
  errorConflict: (_event: string, options: any) =>
    new ConflictException(options.response.message),
  errorNotFound: (_event: string, options: any) =>
    new NotFoundException(options.response.message),
};

const postgresUrl = process.env.OMNI_EXTENSION_PROJECTION_POSTGRES_URL;
const dialectCases: Array<{
  name: "sqlite" | "postgres";
  url?: string;
}> = [
  { name: "sqlite" },
  ...(postgresUrl ? [{ name: "postgres" as const, url: postgresUrl }] : []),
];

describe.each(dialectCases)(
  "Omni extension projection (%s)",
  ({ name, url }) => {
    let dataSource: DataSource;
    let dialect: ProjectionDialect;
    let extensionEntity: any;
    let service: InstanceType<
      typeof OmniExtensionProjectionService<ExtensionRow>
    >;
    let bravoService: InstanceType<
      typeof OmniExtensionProjectionService<ExtensionRow>
    >;

    beforeEach(async () => {
      dialect = createProjectionDialect(name);
      extensionEntity = createOmniExtensionProjectionEntity<ExtensionRow>(
        definition,
        dialect,
      );
      dataSource = new DataSource({
        type: name,
        ...(name === "sqlite"
          ? { database: ":memory:" }
          : { url: url!, ssl: false }),
        dropSchema: true,
        synchronize: true,
        entities: [
          OmniNamedEntity,
          OmniRecordEntity,
          OmniRelationEntity,
          OmniExternalRefEntity,
          extensionEntity,
        ],
      });
      await dataSource.initialize();
      await applyProjectionIndexesForBootstrap(dataSource, dialect, definition);
      const extensions = dataSource.getRepository<ExtensionRow>(extensionEntity);
      const owners = dataSource.getRepository(OmniRecordEntity);
      service = new OmniExtensionProjectionService(
        extensions,
        owners,
        dataSource,
        alphaScope,
        dialect,
        events as never,
        definition,
      );
      bravoService = new OmniExtensionProjectionService(
        extensions,
        owners,
        dataSource,
        bravoScope,
        dialect,
        events as never,
        definition,
      );
    });

    afterEach(async () => {
      if (dataSource.isInitialized) await dataSource.destroy();
    });

    it("creates, reads, filters, sorts, patches, and isolates owner identity by scope and kind", async () => {
      const first = await service.createEntity({
        guid: firstGuid,
        label: "first",
        priority: 2,
        enabled: true,
        payload: { retained: true },
      });
      await service.createEntity({
        guid: secondGuid,
        label: "second",
        priority: 1,
        enabled: false,
      });
      await bravoService.createEntity({
        guid: firstGuid,
        label: "bravo copy",
        priority: 8,
        enabled: true,
      });

      expect(first).toMatchObject({
        guid: firstGuid,
        label: "first",
        priority: 2,
        revision: 1,
        payload: { retained: true, attributes: { priority: 2, enabled: true } },
      });
      expect(await bravoService.getEntity({ guid: firstGuid })).toMatchObject({
        label: "bravo copy",
        priority: 8,
        enabled: true,
        revision: 1,
      });
      const [grid, count] = (await service.getEntityListExtended(
        {
          where: { filters: { priority: 2, enabled: true } },
          order: { label: "DESC" },
        } as never,
        true,
      )) as [ExtensionRow[], number];
      expect(count).toBe(1);
      expect(grid).toEqual([expect.objectContaining({ guid: firstGuid })]);

      const updated = await service.updateEntity(
        { guid: firstGuid },
        {
          expectedRevision: 1,
          priority: 3,
          enabled: false,
          label: "first updated",
        },
      );
      expect(updated).toMatchObject({
        label: "first updated",
        priority: 3,
        revision: 2,
        payload: {
          retained: true,
          attributes: { priority: 3, enabled: false },
        },
      });
      await expect(
        service.updateEntity(
          { guid: firstGuid },
          { expectedRevision: 1, label: "stale" },
        ),
      ).rejects.toThrow("stale");

      const owners = dataSource.getRepository(OmniRecordEntity);
      await owners.insert({
        scopeId: alphaScope.scopeId,
        guid: thirdGuid,
        title: "Other owner",
        kind: "other_extension",
        status: OmniRecordStatus.Active,
        payloadSchemaId: "other.extension.v1",
        payloadSchemaVersion: 1,
      });
      expect(await service.getEntity({ guid: thirdGuid })).toBeNull();
    });

    it("rolls back owner creation when the extension insert fails and cascades extension cleanup on delete", async () => {
      await service.createEntity({
        guid: firstGuid,
        label: "unique label",
        priority: 1,
        enabled: true,
      });
      const extensions = dataSource.getRepository<ExtensionRow>(extensionEntity);
      await dataSource.query(
        `CREATE UNIQUE INDEX "example_extension_projection_label_unique" ON "${definition.tableName}" ("label")`,
      );
      await expect(
        service.createEntity({
          guid: secondGuid,
          label: "unique label",
          priority: 2,
          enabled: false,
        }),
      ).rejects.toThrow("already exists");
      expect(
        await dataSource.getRepository(OmniRecordEntity).findOneBy({
          scopeId: alphaScope.scopeId,
          guid: secondGuid,
        }),
      ).toBeNull();

      await service.deleteEntity({ guid: firstGuid });
      expect(
        await dataSource.getRepository(OmniRecordEntity).countBy({
          scopeId: alphaScope.scopeId,
          guid: firstGuid,
        }),
      ).toBe(0);
      expect(
        await extensions.countBy({
          scopeId: alphaScope.scopeId,
          guid: firstGuid,
        }),
      ).toBe(0);
    });

    it("rolls back the owner revision when the extension row disappears during a patch", async () => {
      await service.createEntity({
        guid: firstGuid,
        label: "rollback candidate",
        priority: 1,
        enabled: true,
      });
      const patchValues = jest
        .spyOn(dialect, "patchValues")
        .mockResolvedValue(0);

      await expect(
        service.updateEntity(
          { guid: firstGuid },
          { expectedRevision: 1, label: "must roll back" },
        ),
      ).rejects.toThrow("extension row is unavailable");
      expect(
        await dataSource.getRepository(OmniRecordEntity).findOneByOrFail({
          scopeId: alphaScope.scopeId,
          guid: firstGuid,
        }),
      ).toMatchObject({ revision: 1 });
      patchValues.mockRestore();
    });

    it("uses one generic relation table with fixed registered endpoint semantics and validates reusable external-ref targets", async () => {
      await service.createEntity({
        guid: firstGuid,
        label: "source",
        priority: 1,
        enabled: true,
      });
      await service.createEntity({
        guid: secondGuid,
        label: "target",
        priority: 2,
        enabled: false,
      });
      await bravoService.createEntity({
        guid: bravoOnlyGuid,
        label: "bravo only",
        priority: 3,
        enabled: true,
      });
      const records = dataSource.getRepository(OmniRecordEntity);
      const relations = new OmniRelationProjectionService(
        dataSource.getRepository(OmniRelationEntity) as never,
        alphaScope,
        "hard",
        records,
        createOmniRelationKindContract(["links"]),
        relationDefinition,
      );
      const relationGuid = "10000000-0000-4000-8000-000000000010";
      await relations.createEntity({
        guid: relationGuid,
        sourceRecordId: firstGuid,
        targetRecordId: secondGuid,
        payload: { strength: 1 },
      });
      await expect(
        relations.createEntity({
          guid: "10000000-0000-4000-8000-000000000011",
          sourceRecordId: firstGuid,
          targetRecordId: bravoOnlyGuid,
        }),
      ).rejects.toThrow("not found");
      await expect(
        relations.createEntity({
          guid: "10000000-0000-4000-8000-000000000012",
          sourceRecordId: firstGuid,
          targetRecordId: secondGuid,
        }),
      ).rejects.toThrow();
      await expect(
        relations.createEntity({
          guid: "10000000-0000-4000-8000-000000000013",
          sourceRecordId: firstGuid,
          targetRecordId: secondGuid,
          kind: "links",
        }),
      ).rejects.toThrow("server-owned");
      const otherRelationGuid = "10000000-0000-4000-8000-000000000014";
      await dataSource.getRepository(OmniRelationEntity).insert({
        scopeId: alphaScope.scopeId,
        guid: otherRelationGuid,
        sourceRecordId: firstGuid,
        targetRecordId: secondGuid,
        kind: "other_link",
        status: "active",
        payloadSchemaId: "other.link.v1",
        payloadSchemaVersion: 1,
      });
      const otherSchemaRelationGuid =
        "10000000-0000-4000-8000-000000000015";
      await dataSource.getRepository(OmniRelationEntity).insert({
        scopeId: alphaScope.scopeId,
        guid: otherSchemaRelationGuid,
        sourceRecordId: secondGuid,
        targetRecordId: firstGuid,
        kind: "links",
        status: "active",
        payloadSchemaId: "other.link.v1",
        payloadSchemaVersion: 1,
      });
      expect(
        await relations.getEntity({ guid: otherRelationGuid }),
      ).toBeNull();
      expect(await relations.getEntity(otherRelationGuid as never)).toBeNull();
      expect(
        await relations.getEntity({ guid: otherSchemaRelationGuid }),
      ).toBeNull();
      await expect(
        relations.getEntity({ guid: relationGuid, kind: "links" } as never),
      ).rejects.toThrow("server-owned");
      await expect(
        relations.updateEntity(
          { guid: otherRelationGuid },
          { payload: { no: true } },
        ),
      ).rejects.toThrow();
      await expect(
        relations.deleteEntity({ guid: otherRelationGuid }),
      ).rejects.toThrow();
      await expect(
        relations.getEntityListExtended({
          where: { filters: { kind: "other_link" } },
        } as never),
      ).rejects.toThrow("server-owned");
      await expect(
        relations.updateEntity(
          { guid: relationGuid, kind: "links" } as never,
          { payload: { no: true }, expectedRevision: 1 },
        ),
      ).rejects.toThrow("server-owned");
      await expect(
        relations.deleteEntity({ guid: relationGuid, kind: "links" } as never),
      ).rejects.toThrow("server-owned");
      expect(await relations.getEntityListExtended({})).toEqual([
        expect.objectContaining({ guid: relationGuid }),
      ]);
      expect(
        dataSource.entityMetadatas.filter(
          (metadata) => metadata.tableName === "omni-relation",
        ),
      ).toHaveLength(1);

      const validator = new OmniExternalRefBindingValidator(
        records,
        alphaScope,
      );
      await expect(
        validator.assertTarget({
          internalId: firstGuid,
          internalType: OmniExternalRefInternalType.Record,
        }),
      ).resolves.toMatchObject({ guid: firstGuid });
      await expect(
        new OmniExternalRefBindingValidator(records, bravoScope).assertTarget({
          internalId: firstGuid,
          internalType: OmniExternalRefInternalType.Record,
        }),
      ).rejects.toThrow("not found");

      const externalRefs = new OmniExternalRefService(
        dataSource.getRepository(OmniExternalRefEntity) as never,
        alphaScope,
        "hard",
        validator,
      );
      const externalRefGuid = "10000000-0000-4000-8000-000000000020";
      await externalRefs.createEntity({
        guid: externalRefGuid,
        provider: "example",
        externalId: "one",
        internalType: OmniExternalRefInternalType.Record,
        internalId: firstGuid,
      });
      await expect(
        externalRefs.createEntity({
          guid: "10000000-0000-4000-8000-000000000021",
          provider: "example",
          externalId: "missing",
          internalType: OmniExternalRefInternalType.Record,
          internalId: thirdGuid,
        }),
      ).rejects.toThrow("not found");
      await expect(
        new OmniExternalRefService(
          dataSource.getRepository(OmniExternalRefEntity) as never,
          bravoScope,
          "hard",
          new OmniExternalRefBindingValidator(records, bravoScope),
        ).createEntity({
          guid: "10000000-0000-4000-8000-000000000022",
          provider: "example",
          externalId: "cross-scope",
          internalType: OmniExternalRefInternalType.Record,
          internalId: firstGuid,
        }),
      ).rejects.toThrow("not found");
      await expect(
        externalRefs.updateEntity(
          { guid: externalRefGuid },
          { internalId: bravoOnlyGuid },
        ),
      ).rejects.toThrow("immutable");
    });

    it('supports one multi-kind relation surface, public aliases, revisions, and bounded catalog readers', async () => {
      await service.createEntity({
        guid: firstGuid,
        label: 'source',
        priority: 1,
        enabled: true,
      });
      await service.createEntity({
        guid: secondGuid,
        label: 'target',
        priority: 2,
        enabled: false,
      });
      const multiDefinition = defineOmniRelationProjection({
        id: 'example.multi-link.v1',
        relation: {
          allowedKinds: ['links', 'blocks'],
          sourceKind: definition.owner.kind,
          targetKind: definition.owner.kind,
          schema: { id: 'example.multi-link.v1', version: 1 },
        },
        aliases: {
          kind: 'linkKind',
          source: 'sourceWorkItemId',
          target: 'targetWorkItemId',
          payload: 'metadata',
        },
      });
      const relations = new OmniRelationProjectionService(
        dataSource.getRepository(OmniRelationEntity),
        alphaScope,
        'hard',
        dataSource.getRepository(OmniRecordEntity),
        createOmniRelationKindContract(['links', 'blocks']),
        multiDefinition,
        dataSource,
      );
      const relationGuid = '10000000-0000-4000-8000-000000000030';
      const relation = await relations.createEntity({
        guid: relationGuid,
        linkKind: 'links',
        sourceWorkItemId: firstGuid,
        targetWorkItemId: secondGuid,
        metadata: { enabled: true },
      } as never);
      expect(relation).toMatchObject({
        linkKind: 'links',
        sourceWorkItemId: firstGuid,
        targetWorkItemId: secondGuid,
        metadata: { enabled: true },
        revision: 1,
      });
      await expect(
        relations.createEntity({
          guid: '10000000-0000-4000-8000-000000000031',
          linkKind: 'not_registered',
          sourceWorkItemId: firstGuid,
          targetWorkItemId: secondGuid,
        } as never),
      ).rejects.toThrow('not allowed');
      await expect(
        relations.updateEntity(
          { guid: relationGuid },
          { sourceWorkItemId: secondGuid, expectedRevision: 1 } as never,
        ),
      ).rejects.toThrow('immutable');
      const updated = await relations.updateEntity(
        { guid: relationGuid },
        { metadata: { enabled: false }, expectedRevision: 1 } as never,
      );
      expect(updated).toMatchObject({
        metadata: { enabled: false },
        revision: 2,
      });
      await expect(
        relations.updateEntity(
          { guid: relationGuid },
          { metadata: { enabled: true }, expectedRevision: 1 } as never,
        ),
      ).rejects.toThrow('revision conflict');

      const catalog = createOmniProjectionReaderCatalog([
        {
          type: 'extension',
          id: definition.id,
          entity: extensionEntity,
          definition,
        },
        {
          type: 'relation',
          id: multiDefinition.id,
          definition: multiDefinition,
        },
      ]);
      const readers = catalog.bind(dataSource.manager, alphaScope);
      const projectedExtensions = await readers.extension(definition.id).list({
        where: { label: 'source' },
        take: 1,
      });
      expect(projectedExtensions).toEqual([
        expect.objectContaining({
          scopeId: alphaScope.scopeId,
          guid: firstGuid,
          label: 'source',
          revision: 1,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      ]);
      expect(projectedExtensions[0]).not.toHaveProperty('kind');
      await expect(
        readers.extension(definition.id).list({ where: { payload: {} } }),
      ).rejects.toThrow('declared eq fields');
      await expect(
        readers.relation(multiDefinition.id).list({
          sourceRecordId: firstGuid,
          take: 1,
        }),
      ).resolves.toEqual([expect.objectContaining({ guid: relationGuid })]);
      await expect(
        readers.relation(multiDefinition.id).list({ take: 0 }),
      ).rejects.toThrow('take must be an integer');
    });

    it('maps concurrent revision and lifecycle-predicate writes to one success and one conflict', async () => {
      const sqlitePath = join(tmpdir(), `omni-projection-race-${randomUUID()}.sqlite`);
      const options = {
        type: name,
        ...(name === 'sqlite'
          ? { database: sqlitePath }
          : { url: url!, ssl: false }),
        entities: [
          OmniNamedEntity,
          OmniRecordEntity,
          OmniRelationEntity,
          OmniExternalRefEntity,
          extensionEntity,
        ],
      } as const;
      const primary = new DataSource({
        ...options,
        dropSchema: true,
        synchronize: true,
      } as never);
      const secondary = new DataSource({
        ...options,
        synchronize: false,
      } as never);
      await primary.initialize();
      await secondary.initialize();
      try {
        const first = new OmniExtensionProjectionService(
          primary.getRepository<ExtensionRow>(extensionEntity),
          primary.getRepository(OmniRecordEntity),
          primary,
          alphaScope,
          createProjectionDialect(name),
          events as never,
          definition,
        );
        const second = new OmniExtensionProjectionService(
          secondary.getRepository<ExtensionRow>(extensionEntity),
          secondary.getRepository(OmniRecordEntity),
          secondary,
          alphaScope,
          createProjectionDialect(name),
          events as never,
          definition,
        );
        await first.createEntity({
          guid: firstGuid,
          label: 'revision-race',
          enabled: true,
        });
        const revisionOutcomes = await Promise.allSettled([
          first.updateEntity(
            { guid: firstGuid },
            { expectedRevision: 1, label: 'revision race one' },
          ),
          second.updateEntity(
            { guid: firstGuid },
            { expectedRevision: 1, label: 'revision race two' },
          ),
        ]);
        expect(
          revisionOutcomes.filter((result) => result.status === 'fulfilled'),
        ).toHaveLength(1);
        expect(
          revisionOutcomes.filter((result) => result.status === 'rejected'),
        ).toHaveLength(1);

        let waiting = 0;
        let release: (() => void) | undefined;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const lifecycle = {
          beforeCreate: async (context: any) => {
            const existing = await context.readers.extension(definition.id).list({
              where: { label: 'predicate-singleton' },
              take: 1,
            });
            if (existing.length > 0) {
              throw new ConflictException('Lifecycle predicate already holds.');
            }
            waiting += 1;
            if (waiting === 2) release?.();
            await gate;
          },
        };
        const guardedFirst = new OmniExtensionProjectionService(
          primary.getRepository<ExtensionRow>(extensionEntity),
          primary.getRepository(OmniRecordEntity),
          primary,
          alphaScope,
          createProjectionDialect(name),
          events as never,
          definition,
          lifecycle,
        );
        const guardedSecond = new OmniExtensionProjectionService(
          secondary.getRepository<ExtensionRow>(extensionEntity),
          secondary.getRepository(OmniRecordEntity),
          secondary,
          alphaScope,
          createProjectionDialect(name),
          events as never,
          definition,
          lifecycle,
        );
        const lifecycleOutcomes = await Promise.allSettled([
          guardedFirst.createEntity({
            guid: secondGuid,
            label: 'predicate-singleton',
            enabled: true,
          }),
          guardedSecond.createEntity({
            guid: thirdGuid,
            label: 'predicate-singleton',
            enabled: false,
          }),
        ]);
        expect(
          lifecycleOutcomes.filter((result) => result.status === 'fulfilled'),
        ).toHaveLength(1);
        expect(
          lifecycleOutcomes.filter((result) => result.status === 'rejected'),
        ).toHaveLength(1);
        expect(
          lifecycleOutcomes.find(
            (result): result is PromiseRejectedResult => result.status === 'rejected',
          )!.reason,
        ).toBeInstanceOf(ConflictException);
      } finally {
        if (secondary.isInitialized) await secondary.destroy();
        if (primary.isInitialized) {
          await primary.dropDatabase();
          await primary.destroy();
        }
        if (name === 'sqlite') await rm(sqlitePath, { force: true });
      }
    });
  },
);
