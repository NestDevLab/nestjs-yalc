import { afterEach, describe, expect, it } from "@jest/globals";
import {
  compileProjectionUniqueConstraintPredicate,
  createProjectionDialect,
} from "@nestjs-yalc/crud-gen";
import { DataSource } from "typeorm";

const { OmniNamedEntity } = await import("../base/omni-named.entity.js");
const { OmniRecordEntity } = await import("../base/omni-record.entity.js");
const { OmniRelationEntity } = await import("../base/omni-relation.entity.js");
const { OmniExternalRefEntity } =
  await import("../base/omni-external-ref.entity.js");
const { OmniCollectionEntity } = await import("../omni-collection.entity.js");
const { OmniDocumentEntity } = await import("../omni-document.entity.js");
const { OmniRecordStatus } = await import("../omni-record-status.enum.js");
const {
  createOmniExtensionProjectionEntity,
  createOmniExtensionProjectionTable,
  defineOmniExtensionProjection,
} = await import("../omni-extension-projection.definition.js");
const { captureOmniMigrationSnapshot } = await import("../omni-migration.js");

const constraintName = "projection_status_initial_kind_unique";
const fullConstraintName = "projection_status_kind_state_unique";
const referenceName = "projection_status_parent_fk";
const tableName = "projection-status-constraint-probe";
const alphaScope = "scope-alpha";
const bravoScope = "scope-bravo";

type ConstraintRow = {
  scopeId: string;
  guid: string;
  parentGuid: string;
  key: string;
  kind: string;
  state: string;
  isInitial: boolean;
  payload: Record<string, unknown>;
};

function definitionInput() {
  return {
    id: "projection.status.constraint-probe.v1",
    tableName,
    identity: { column: "guid", uniqueWithinScope: true as const },
    scope: { column: "scopeId", serverOwned: true as const },
    revision: { column: "revision" },
    payload: { column: "payload", allowCreate: true },
    deletion: "hard" as const,
    fields: [
      {
        name: "guid",
        storage: "column" as const,
        column: "guid",
        codec: "uuid" as const,
        nullable: false,
        requiredOnCreate: true,
      },
      {
        name: "parentGuid",
        storage: "column" as const,
        column: "parentGuid",
        codec: "uuid" as const,
        nullable: false,
        requiredOnCreate: true,
      },
      {
        name: "key",
        storage: "column" as const,
        column: "key",
        codec: "string" as const,
        nullable: false,
        requiredOnCreate: true,
      },
      {
        name: "kind",
        storage: "column" as const,
        column: "kind",
        codec: "string" as const,
        nullable: false,
        requiredOnCreate: true,
      },
      {
        name: "state",
        storage: "column" as const,
        column: "state",
        codec: "string" as const,
        nullable: false,
        requiredOnCreate: true,
      },
      {
        name: "isInitial",
        storage: "column" as const,
        column: "isInitial",
        codec: "boolean" as const,
        nullable: false,
        requiredOnCreate: true,
      },
      {
        name: "metadata",
        storage: "json" as const,
        path: ["metadata"],
        codec: "json" as const,
        nullable: true,
      },
    ],
    references: [
      {
        name: referenceName,
        fields: ["parentGuid"],
        target: {
          tableName: "omni-record",
          scopeColumn: "scopeId",
          identityColumns: ["guid"],
        },
        onDelete: "RESTRICT" as const,
      },
    ],
    uniqueConstraints: [
      {
        name: constraintName,
        fields: ["kind"],
        predicate: { isInitial: true, state: "active" },
      },
      {
        name: fullConstraintName,
        fields: ["key", "kind"],
      },
    ],
    owner: {
      kind: "projection_status_constraint_probe",
      title: "Projection status constraint probe",
      status: OmniRecordStatus.Active,
      schema: { id: "projection.status.constraint-probe.v1", version: 1 },
    },
  };
}

const definition = defineOmniExtensionProjection(definitionInput());

function expectInvalidDefinition(mutate: (input: any) => void): void {
  const input = definitionInput();
  mutate(input);
  expect(() => defineOmniExtensionProjection(input)).toThrow(TypeError);
}

function expectConstraintMetadata(
  table: ReturnType<typeof createOmniExtensionProjectionTable>,
  dialect: "sqlite" | "postgres",
): void {
  const reference = table.foreignKeys.find(
    (foreignKey) => foreignKey.name === referenceName,
  );
  expect(reference).toMatchObject({
    columnNames: ["scopeId", "parentGuid"],
    referencedTableName: "omni-record",
    referencedColumnNames: ["scopeId", "guid"],
    onDelete: "RESTRICT",
  });
  expect(table.indices).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: `${referenceName}_idx`,
        columnNames: ["scopeId", "parentGuid"],
        isUnique: false,
      }),
      expect.objectContaining({
        name: constraintName,
        columnNames: ["scopeId", "kind"],
        isUnique: true,
        where:
          dialect === "sqlite"
            ? '"isInitial" = 1 AND "state" = \'active\''
            : '"isInitial" = TRUE AND "state" = \'active\'',
      }),
      expect.objectContaining({
        name: fullConstraintName,
        columnNames: ["scopeId", "key", "kind"],
        isUnique: true,
        where: "",
      }),
    ]),
  );
}

describe("Omni extension projection declarative constraints", () => {
  it("deep-freezes valid metadata and rejects unsafe declarative constraints", () => {
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.references)).toBe(true);
    expect(Object.isFrozen(definition.references![0]!)).toBe(true);
    expect(Object.isFrozen(definition.uniqueConstraints)).toBe(true);
    expect(Object.isFrozen(definition.uniqueConstraints![0]!.predicate)).toBe(
      true,
    );

    expectInvalidDefinition((input) => {
      input.references[0].fields = ["metadata"];
    });
    expectInvalidDefinition((input) => {
      input.uniqueConstraints[0].predicate = { metadata: "not portable" };
    });
    expectInvalidDefinition((input) => {
      input.references[0].fields = ["missing"];
    });
    expectInvalidDefinition((input) => {
      input.references[0].fields = ["guid"];
    });
    expectInvalidDefinition((input) => {
      input.uniqueConstraints[0].fields = ["scopeId"];
    });
    expectInvalidDefinition((input) => {
      input.references.push({ ...input.references[0] });
    });
    expectInvalidDefinition((input) => {
      input.uniqueConstraints[0].name = referenceName;
    });
    expectInvalidDefinition((input) => {
      input.references[0].target.identityColumns = ["guid", "kind"];
    });
    expectInvalidDefinition((input) => {
      input.references[0].onDelete = "CASCADE";
    });
    expectInvalidDefinition((input) => {
      input.references[0].name = "unsafe;reference";
    });
  });

  it("compiles portable predicate literals and Table metadata for both dialects", () => {
    const uniqueConstraint = definition.uniqueConstraints![0]!;
    expect(
      compileProjectionUniqueConstraintPredicate(
        definition,
        uniqueConstraint,
        "sqlite",
      ),
    ).toBe('"isInitial" = 1 AND "state" = \'active\'');
    expect(
      compileProjectionUniqueConstraintPredicate(
        definition,
        uniqueConstraint,
        "postgres",
      ),
    ).toBe('"isInitial" = TRUE AND "state" = \'active\'');
    expect(
      compileProjectionUniqueConstraintPredicate(
        definition,
        definition.uniqueConstraints![1]!,
        "sqlite",
      ),
    ).toBeUndefined();

    const sqliteTable = createOmniExtensionProjectionTable(
      definition,
      createProjectionDialect("sqlite"),
    );
    const postgresTable = createOmniExtensionProjectionTable(
      definition,
      createProjectionDialect("postgres"),
    );
    expect(sqliteTable.findColumnByName("payload")?.type).toBe("text");
    expect(postgresTable.findColumnByName("payload")?.type).toBe("jsonb");
    expectConstraintMetadata(sqliteTable, "sqlite");
    expectConstraintMetadata(postgresTable, "postgres");
  });
});

describe("Omni extension projection constraints in SQLite", () => {
  let dataSource: DataSource;

  afterEach(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it("enforces same-scope references and partial uniqueness in live metadata and snapshots", async () => {
    const entity = createOmniExtensionProjectionEntity<ConstraintRow>(
      definition,
      createProjectionDialect("sqlite"),
    );
    dataSource = new DataSource({
      type: "sqlite",
      database: ":memory:",
      dropSchema: true,
      synchronize: true,
      entities: [
        OmniNamedEntity,
        OmniRecordEntity,
        OmniDocumentEntity,
        OmniCollectionEntity,
        OmniRelationEntity,
        OmniExternalRefEntity,
        entity,
      ],
    });
    await dataSource.initialize();

    const metadata = dataSource.getMetadata(entity);
    expect(metadata.foreignKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: referenceName,
          columnNames: ["scopeId", "parentGuid"],
          referencedTablePath: "omni-record",
          referencedColumnNames: ["scopeId", "guid"],
          onDelete: "RESTRICT",
        }),
      ]),
    );
    expect(metadata.indices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          givenName: `${referenceName}_idx`,
          where: undefined,
          isUnique: false,
        }),
        expect.objectContaining({
          givenName: constraintName,
          where: '"isInitial" = 1 AND "state" = \'active\'',
          isUnique: true,
        }),
      ]),
    );

    const owners = dataSource.getRepository(OmniRecordEntity);
    const extensions = dataSource.getRepository<ConstraintRow>(entity);
    const parentGuid = "10000000-0000-4000-8000-000000000001";
    const crossScopeParentGuid = "10000000-0000-4000-8000-000000000002";
    const ownerGuid = "10000000-0000-4000-8000-000000000003";
    const duplicateOwnerGuid = "10000000-0000-4000-8000-000000000004";
    const excludedOwnerGuid = "10000000-0000-4000-8000-000000000005";
    const missingParentOwnerGuid = "10000000-0000-4000-8000-000000000006";
    const crossScopeOwnerGuid = "10000000-0000-4000-8000-000000000007";

    const createOwner = async (
      scopeId: string,
      guid: string,
    ): Promise<void> => {
      await owners.insert({
        scopeId,
        guid,
        title: `Owner ${guid}`,
        kind: "projection_status_constraint_probe",
        status: OmniRecordStatus.Active,
        payloadSchemaId: definition.owner.schema.id,
        payloadSchemaVersion: definition.owner.schema.version,
      });
    };
    await createOwner(alphaScope, parentGuid);
    await createOwner(bravoScope, crossScopeParentGuid);
    await createOwner(alphaScope, ownerGuid);
    await createOwner(alphaScope, duplicateOwnerGuid);
    await createOwner(alphaScope, excludedOwnerGuid);
    await createOwner(alphaScope, missingParentOwnerGuid);
    await createOwner(alphaScope, crossScopeOwnerGuid);

    await extensions.insert({
      scopeId: alphaScope,
      guid: ownerGuid,
      parentGuid,
      key: "primary",
      kind: "approval",
      state: "active",
      isInitial: true,
      payload: {},
    });
    await expect(
      extensions.insert({
        scopeId: alphaScope,
        guid: missingParentOwnerGuid,
        parentGuid: "10000000-0000-4000-8000-000000000099",
        key: "missing-parent",
        kind: "missing-parent",
        state: "active",
        isInitial: false,
        payload: {},
      }),
    ).rejects.toThrow();
    await expect(
      extensions.insert({
        scopeId: alphaScope,
        guid: crossScopeOwnerGuid,
        parentGuid: crossScopeParentGuid,
        key: "cross-scope",
        kind: "cross-scope-parent",
        state: "active",
        isInitial: false,
        payload: {},
      }),
    ).rejects.toThrow();
    await expect(
      extensions.insert({
        scopeId: alphaScope,
        guid: duplicateOwnerGuid,
        parentGuid,
        key: "duplicate-partial",
        kind: "approval",
        state: "active",
        isInitial: true,
        payload: {},
      }),
    ).rejects.toThrow();
    await extensions.insert({
      scopeId: alphaScope,
      guid: excludedOwnerGuid,
      parentGuid,
      key: "inactive",
      kind: "approval",
      state: "active",
      isInitial: false,
      payload: {},
    });
    await expect(
      owners.delete({ scopeId: alphaScope, guid: parentGuid }),
    ).rejects.toThrow();

    const snapshot = captureOmniMigrationSnapshot(
      "projection-status-constraint-probe-sqlite-v1",
      dataSource,
      [{ entities: [entity], definition }],
    );
    const capturedTable = snapshot.tables.find(
      (table) => table.name === tableName,
    )!;
    expect(capturedTable.foreignKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: referenceName,
          columnNames: ["scopeId", "parentGuid"],
          referencedTableName: "omni-record",
          referencedColumnNames: ["scopeId", "guid"],
          onDelete: "RESTRICT",
        }),
      ]),
    );
    expect(capturedTable.indices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: `${referenceName}_idx`,
          columnNames: ["scopeId", "parentGuid"],
          isUnique: false,
        }),
        expect.objectContaining({
          name: constraintName,
          columnNames: ["scopeId", "kind"],
          isUnique: true,
          where: '"isInitial" = 1 AND "state" = \'active\'',
        }),
      ]),
    );
  });
});

const postgresUrl = process.env.OMNI_EXTENSION_PROJECTION_POSTGRES_URL;
const postgresIt = postgresUrl ? it : it.skip;

describe("Omni extension projection constraints in PostgreSQL", () => {
  postgresIt(
    "initializes an ephemeral database with PostgreSQL metadata",
    async () => {
      const entity = createOmniExtensionProjectionEntity<ConstraintRow>(
        definition,
        createProjectionDialect("postgres"),
      );
      const dataSource = new DataSource({
        type: "postgres",
        url: postgresUrl!,
        ssl: false,
        dropSchema: true,
        synchronize: true,
        entities: [
          OmniNamedEntity,
          OmniRecordEntity,
          OmniDocumentEntity,
          OmniCollectionEntity,
          OmniRelationEntity,
          OmniExternalRefEntity,
          entity,
        ],
      });
      try {
        await dataSource.initialize();
        const metadata = dataSource.getMetadata(entity);
        expect(metadata.indices).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              givenName: constraintName,
              where: '"isInitial" = TRUE AND "state" = \'active\'',
              isUnique: true,
            }),
          ]),
        );
        const columns = await dataSource.query(
          "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND column_name IN ($2, $3)",
          [tableName, "payload", "isInitial"],
        );
        expect(columns).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              column_name: "payload",
              data_type: "jsonb",
            }),
            expect.objectContaining({
              column_name: "isInitial",
              data_type: "boolean",
            }),
          ]),
        );
        const indexes = await dataSource.query(
          "SELECT indexdef FROM pg_indexes WHERE tablename = $1 AND indexname = $2",
          [tableName, constraintName],
        );
        expect(indexes[0]?.indexdef).toContain("WHERE");
        expect(indexes[0]?.indexdef).toContain('"isInitial"');
        expect(indexes[0]?.indexdef).toContain("state");
      } finally {
        if (dataSource.isInitialized) await dataSource.destroy();
      }
    },
  );
});
