import type { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { Table, TableForeignKey, type TableOptions } from 'typeorm';
import {
  createProjectionDialect,
  type ProjectionResourceDefinition,
} from '@nestjs-yalc/crud-gen';
import { OmniExternalRefEntity } from './base/omni-external-ref.entity.js';
import { OmniNamedEntity } from './base/omni-named.entity.js';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import { OmniRelationEntity } from './base/omni-relation.entity.js';
import { OmniCollectionEntity } from './omni-collection.entity.js';
import { OmniDocumentEntity } from './omni-document.entity.js';

export interface OmniMigrationSnapshot {
  /** A migration-owned identifier, for example `omni-v1`. */
  readonly version: string;
  /** The driver whose physical column types were captured. */
  readonly dialect: 'sqlite' | 'postgres';
  /** Immutable, serializable TypeORM TableOptions captured during authoring. */
  readonly tables: readonly TableOptions[];
  /** Immutable ProjectionDialect DDL for JSON/expression indexes. */
  readonly indexStatements: readonly string[];
}

/**
 * The portable subset of a migration runner used by an Omni migration plan.
 *
 * It deliberately does not reference TypeORM's `QueryRunner` type. A package
 * manager may give the module and a consuming migration distinct physical
 * TypeORM installations, even at the same version; exposing that branded
 * framework type would then reject the application's runner. TypeORM runners
 * satisfy this structural capability contract without a consumer cast.
 */
export interface OmniMigrationRunner {
  createTable(
    table: unknown,
    ifNotExist?: boolean,
    createForeignKeys?: boolean,
    createIndices?: boolean,
  ): Promise<void>;
  query(statement: string): Promise<unknown>;
}

export interface OmniMigrationPlan {
  readonly version: string;
  readonly tableNames: readonly string[];
  /** Dialect-compiled index DDL that the plan executes after all tables exist. */
  readonly indexStatements: readonly string[];
  /** Returns fresh mutable Table instances from the versioned source snapshot. */
  createTables(): Table[];
  /** Intended only from a TypeORM migration up() method. */
  create(queryRunner: OmniMigrationRunner): Promise<void>;
  /** Intended only from a TypeORM migration down() method. */
  drop(queryRunner: OmniMigrationRunner): Promise<void>;
}

/**
 * The migration-relevant subset of a registered extension composition. It
 * keeps schema authoring tied to the same immutable projection definition as
 * the generated transport and service, without making runtime metadata a
 * migration dependency.
 */
export interface OmniMigrationExtensionRegistration {
  readonly entities: readonly EntityTarget<any>[];
  readonly definition: ProjectionResourceDefinition;
}

const omniBaseEntities = [
  OmniNamedEntity,
  OmniRecordEntity,
  OmniDocumentEntity,
  OmniCollectionEntity,
  OmniRelationEntity,
  OmniExternalRefEntity,
] as const;

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      freezeDeep(child);
    }
    Object.freeze(value);
  }
  return value;
}

function dialectFor(dataSource: DataSource): 'sqlite' | 'postgres' {
  if (dataSource.options.type === 'sqlite') return 'sqlite';
  if (dataSource.options.type === 'postgres') return 'postgres';
  throw new TypeError('Omni migration snapshots support SQLite or PostgreSQL.');
}

function tableOptions(table: Table): TableOptions {
  return {
    database: table.database,
    schema: table.schema,
    name: table.name,
    withoutRowid: table.withoutRowid,
    engine: table.engine,
    comment: table.comment,
    columns: table.columns.map((column) => ({
      name: column.name,
      type: column.type,
      default: column.default,
      onUpdate: column.onUpdate,
      isNullable: column.isNullable,
      isGenerated: column.isGenerated,
      generationStrategy: column.generationStrategy,
      isPrimary: column.isPrimary,
      isUnique: column.isUnique,
      isArray: column.isArray,
      comment: column.comment,
      length: column.length,
      width: column.width,
      charset: column.charset,
      collation: column.collation,
      precision: column.precision,
      scale: column.scale,
      zerofill: column.zerofill,
      unsigned: column.unsigned,
      enum: column.enum ? [...column.enum] : undefined,
      enumName: column.enumName,
      primaryKeyConstraintName: column.primaryKeyConstraintName,
      asExpression: column.asExpression,
      generatedType: column.generatedType,
      generatedIdentity: column.generatedIdentity,
      spatialFeatureType: column.spatialFeatureType,
      srid: column.srid,
    })),
    indices: table.indices.map((index) => ({
      name: index.name,
      columnNames: [...index.columnNames],
      isUnique: index.isUnique,
      isSpatial: index.isSpatial,
      isConcurrent: index.isConcurrent,
      isFulltext: index.isFulltext,
      isNullFiltered: index.isNullFiltered,
      parser: index.parser,
      where: index.where,
    })),
    foreignKeys: table.foreignKeys.map((foreignKey) => ({
      name: foreignKey.name,
      columnNames: [...foreignKey.columnNames],
      referencedDatabase: foreignKey.referencedDatabase,
      referencedSchema: foreignKey.referencedSchema,
      referencedTableName: foreignKey.referencedTableName,
      referencedColumnNames: [...foreignKey.referencedColumnNames],
      onDelete: foreignKey.onDelete,
      onUpdate: foreignKey.onUpdate,
      deferrable: foreignKey.deferrable,
    })),
    uniques: table.uniques.map((unique) => ({
      name: unique.name,
      columnNames: [...unique.columnNames],
      deferrable: unique.deferrable,
    })),
    checks: table.checks.map((check) => ({
      name: check.name,
      columnNames: check.columnNames ? [...check.columnNames] : undefined,
      expression: check.expression,
    })),
    exclusions: table.exclusions.map((exclusion) => ({
      name: exclusion.name,
      expression: exclusion.expression,
    })),
  };
}

function tableSnapshots(
  dataSource: DataSource,
  entities: readonly EntityTarget<ObjectLiteral>[],
): TableOptions[] {
  const byTableName = new Map<string, Table>();
  for (const entity of entities) {
    const metadata = dataSource.getMetadata(entity);
    const table = Table.create(metadata, dataSource.driver);
    table.foreignKeys = metadata.foreignKeys.map((foreignKey) =>
      TableForeignKey.create(foreignKey, dataSource.driver),
    );
    const current = byTableName.get(table.name);
    if (!current || current.columns.length < table.columns.length) {
      byTableName.set(table.name, table);
    }
  }

  return orderTablesTopologically([...byTableName.values()].map(tableOptions));
}

/**
 * Orders a complete migration snapshot from FK parents to children. A
 * migration may not defer this to registration order: PostgreSQL requires the
 * referenced table to exist at FK creation time. Self references are valid;
 * cross-table cycles are rejected during migration authoring.
 */
function orderTablesTopologically(
  tables: readonly TableOptions[],
): TableOptions[] {
  const byName = new Map<string, TableOptions>();
  for (const table of tables) {
    if (!table.name)
      throw new TypeError('Omni migration table name is required.');
    byName.set(table.name, table);
  }
  const dependencies = new Map<string, Set<string>>();
  for (const table of tables) {
    const tableName = table.name!;
    const parents = new Set<string>();
    for (const foreignKey of table.foreignKeys ?? []) {
      const parent = foreignKey.referencedTableName;
      if (!parent || parent === tableName) continue;
      if (!byName.has(parent)) {
        throw new TypeError(
          `Omni migration table ${tableName} references ${parent}, which is absent from this snapshot.`,
        );
      }
      parents.add(parent);
    }
    dependencies.set(tableName, parents);
  }
  const remaining = new Map(
    [...dependencies.entries()].map(([name, parents]) => [
      name,
      new Set(parents),
    ]),
  );
  const ordered: TableOptions[] = [];
  while (remaining.size > 0) {
    const ready = tables.filter(
      (table) =>
        table.name !== undefined && remaining.get(table.name)?.size === 0,
    );
    if (ready.length === 0) {
      throw new TypeError(
        `Omni migration snapshot has a cross-table foreign-key cycle: ${[
          ...remaining.keys(),
        ].join(', ')}.`,
      );
    }
    for (const table of ready) {
      const name = table.name!;
      remaining.delete(name);
      ordered.push(table);
      for (const parents of remaining.values()) parents.delete(name);
    }
  }
  return ordered;
}

function quotedIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quotedTableName(table: TableOptions): string {
  if (!table.name)
    throw new TypeError('Omni migration table name is required.');
  return [table.schema, table.name]
    .filter(
      (part): part is string => typeof part === 'string' && part.length > 0,
    )
    .map(quotedIdentifier)
    .join('.');
}

/**
 * Authoring-only helper. Run this against a metadata-only DataSource and copy
 * the returned value into a versioned migration source using
 * defineOmniMigrationSnapshot. Never invoke it from a migration at runtime.
 */
export function captureOmniMigrationSnapshot(
  version: string,
  dataSource: DataSource,
  extensions: readonly OmniMigrationExtensionRegistration[] = [],
): OmniMigrationSnapshot {
  const dialect = dialectFor(dataSource);
  return defineOmniMigrationSnapshot({
    version,
    dialect,
    tables: tableSnapshots(dataSource, [
      ...omniBaseEntities,
      ...extensions.flatMap((extension) => extension.entities),
    ]),
    indexStatements: extensions.flatMap((extension) =>
      createProjectionDialect(dialect).compileIndexStatements(
        extension.definition,
      ),
    ),
  });
}

/**
 * Freezes a migration-owned table snapshot. Old migration source calls this
 * with a literal captured at authoring time, so future entity changes cannot
 * alter its DDL.
 */
export function defineOmniMigrationSnapshot(
  snapshot: OmniMigrationSnapshot,
): OmniMigrationSnapshot {
  if (
    typeof snapshot.version !== 'string' ||
    snapshot.version.trim().length === 0
  ) {
    throw new TypeError('Omni migration snapshot version is required.');
  }
  if (snapshot.dialect !== 'sqlite' && snapshot.dialect !== 'postgres') {
    throw new TypeError('Omni migration snapshot dialect is unsupported.');
  }
  if (!Array.isArray(snapshot.tables) || snapshot.tables.length === 0) {
    throw new TypeError('Omni migration snapshot requires at least one table.');
  }
  const names = snapshot.tables.map((table) => table.name);
  if (
    names.some((name) => typeof name !== 'string' || name.length === 0) ||
    new Set(names).size !== names.length
  ) {
    throw new TypeError('Omni migration snapshot table names must be unique.');
  }
  if (
    !Array.isArray(snapshot.indexStatements) ||
    snapshot.indexStatements.some(
      (statement) =>
        typeof statement !== 'string' || statement.trim().length === 0,
    ) ||
    new Set(snapshot.indexStatements).size !== snapshot.indexStatements.length
  ) {
    throw new TypeError(
      'Omni migration snapshot index statements must be unique non-empty strings.',
    );
  }
  return freezeDeep(structuredClone(snapshot));
}

/**
 * Creates a migration executor from an already-versioned snapshot. This API
 * deliberately accepts no DataSource or entity classes: runtime metadata is
 * never a migration authority.
 */
export function createOmniMigrationPlan(
  snapshot: OmniMigrationSnapshot,
): OmniMigrationPlan {
  const source = defineOmniMigrationSnapshot(snapshot);
  const tables = orderTablesTopologically(source.tables);

  return Object.freeze({
    version: source.version,
    tableNames: Object.freeze(tables.map((table) => table.name)),
    indexStatements: Object.freeze([...source.indexStatements]),
    createTables: () =>
      tables.map((table) => new Table(structuredClone(table))),
    create: async (queryRunner: OmniMigrationRunner) => {
      for (const table of tables) {
        await queryRunner.createTable(new Table(structuredClone(table)));
      }
      for (const statement of source.indexStatements) {
        await queryRunner.query(statement);
      }
    },
    drop: async (queryRunner: OmniMigrationRunner) => {
      for (const table of [...tables].reverse()) {
        await queryRunner.query(
          `DROP TABLE IF EXISTS ${quotedTableName(table)}`,
        );
      }
    },
  });
}
