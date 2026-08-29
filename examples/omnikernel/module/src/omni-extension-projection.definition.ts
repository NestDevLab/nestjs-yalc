import {
  compileProjectionUniqueConstraintPredicate,
  createProjectionSchemaOptions,
  defineProjectionResource,
  getProjectionReferenceColumnNames,
  getProjectionReferenceIndexName,
  getProjectionReferenceTargetColumnNames,
  getProjectionUniqueConstraintColumnNames,
  type ProjectionDialect,
  type ProjectionResourceDefinition,
} from '@nestjs-yalc/crud-gen';
import {
  Column,
  Entity,
  ForeignKey,
  Index,
  PrimaryColumn,
  Table,
  type EntityTarget,
  type EntitySchemaColumnOptions,
  type ObjectLiteral,
} from 'typeorm';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import { OmniRecordStatus } from './omni-record-status.enum.js';

export interface OmniExtensionProjectionDefinition extends ProjectionResourceDefinition {
  /**
   * Immutable metadata written only to the Omni record that owns every
   * extension row. The extension table never mirrors these values.
   */
  owner: {
    kind: string;
    title: string;
    status: OmniRecordStatus;
    schema: {
      id: string;
      version: number;
    };
  };
}

function assertNonEmptyString(
  value: unknown,
  label: string,
  max: number,
): void {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > max
  ) {
    throw new TypeError(
      `${label} must be a non-empty string up to ${max} characters.`,
    );
  }
}

/**
 * Defines an owner-extension projection. The inherited projection metadata
 * remains the single source for public fields, codecs, JSON paths, and query
 * capabilities; the extra owner block fixes Omni record metadata server-side.
 */
export function defineOmniExtensionProjection<
  TDefinition extends OmniExtensionProjectionDefinition,
>(definition: TDefinition): Readonly<TDefinition> {
  assertNonEmptyString(definition.owner?.kind, 'Omni extension owner kind', 64);
  assertNonEmptyString(
    definition.owner?.title,
    'Omni extension owner title',
    255,
  );
  assertNonEmptyString(
    definition.owner?.schema?.id,
    'Omni extension owner schema id',
    128,
  );
  if (
    !Number.isInteger(definition.owner?.schema?.version) ||
    definition.owner.schema.version < 1 ||
    definition.owner.schema.version > 2_147_483_647
  ) {
    throw new TypeError(
      'Omni extension owner schema version must be a positive signed 32-bit integer.',
    );
  }
  if (!Object.values(OmniRecordStatus).includes(definition.owner.status)) {
    throw new TypeError(
      'Omni extension owner status must be an Omni record status.',
    );
  }

  return defineProjectionResource(definition);
}

function extensionSchema(
  definition: OmniExtensionProjectionDefinition,
  dialect: ProjectionDialect,
): {
  columns: Record<string, EntitySchemaColumnOptions>;
  indices: ReturnType<typeof createProjectionSchemaOptions>['indices'];
  foreignKeys: Array<{
    name: string;
    columnNames: string[];
    referencedTableName: string;
    referencedColumnNames: string[];
    onDelete: 'RESTRICT' | 'NO ACTION';
  }>;
} {
  const projectionSchema = createProjectionSchemaOptions(definition, dialect);
  const { [definition.revision.column]: _ownerRevision, ...columns } =
    projectionSchema.columns;
  const scopeColumn = definition.scope.column;
  const identityColumn = definition.identity.column;

  columns[scopeColumn] = {
    ...columns[scopeColumn],
    primary: true,
    nullable: false,
  };
  columns[identityColumn] = {
    ...columns[identityColumn],
    primary: true,
    nullable: false,
    length: 36,
  };

  const references = definition.references ?? [];
  const uniqueConstraints = definition.uniqueConstraints ?? [];
  return {
    columns,
    indices: [
      ...projectionSchema.indices,
      ...references.map((reference) => ({
        name: getProjectionReferenceIndexName(reference),
        columns: getProjectionReferenceColumnNames(definition, reference),
        unique: false,
      })),
      ...uniqueConstraints.map((constraint) => ({
        name: constraint.name,
        columns: getProjectionUniqueConstraintColumnNames(
          definition,
          constraint,
        ),
        unique: true,
        where: compileProjectionUniqueConstraintPredicate(
          definition,
          constraint,
          dialect.name,
        ),
      })),
    ],
    foreignKeys: references.map((reference) => ({
      name: reference.name,
      columnNames: getProjectionReferenceColumnNames(definition, reference),
      referencedTableName: reference.target.tableName,
      referencedColumnNames: getProjectionReferenceTargetColumnNames(reference),
      onDelete: reference.onDelete,
    })),
  };
}

function migrationColumnType(type: EntitySchemaColumnOptions['type']): string {
  if (type === String) return 'varchar';
  if (type === Number) return 'integer';
  if (type === Boolean) return 'boolean';
  if (type === 'simple-json') return 'text';
  if (typeof type === 'string') return type;
  throw new TypeError('Omni extension projection column type is unsupported.');
}

/**
 * Builds a TypeORM entity target for one extension table. This is deliberately
 * a decorated class, rather than an EntitySchema: TypeORM builds EntitySchema
 * metadata separately and cannot resolve an EntitySchema foreign key to the
 * decorated OmniRecordEntity. The generated class keeps both sides in the
 * same metadata pass, allowing the composite FK to be synchronized normally.
 */
export function createOmniExtensionProjectionEntity<
  Extension extends ObjectLiteral,
>(
  definition: OmniExtensionProjectionDefinition,
  dialect: ProjectionDialect,
): EntityTarget<Extension> {
  const { columns, indices, foreignKeys } = extensionSchema(
    definition,
    dialect,
  );
  const scopeColumn = definition.scope.column;
  const identityColumn = definition.identity.column;

  class OmniExtensionProjectionEntity {}

  Entity(definition.tableName)(OmniExtensionProjectionEntity);
  for (const [columnName, declared] of Object.entries(columns)) {
    const options = { ...declared };
    const primary = options.primary === true;
    delete options.primary;
    if (primary) {
      PrimaryColumn(options.type as never, options as never)(
        OmniExtensionProjectionEntity.prototype,
        columnName,
      );
    } else if (typeof options.type === 'function') {
      Column(options as never)(
        OmniExtensionProjectionEntity.prototype,
        columnName,
      );
    } else {
      Column(options.type as never, options as never)(
        OmniExtensionProjectionEntity.prototype,
        columnName,
      );
    }
  }
  for (const index of indices) {
    if (!index.name || !Array.isArray(index.columns)) {
      throw new TypeError(
        'Omni extension projection indexes require a name and column list.',
      );
    }
    Index(index.name, index.columns, {
      unique: index.unique,
      ...(index.where ? { where: index.where } : {}),
    })(OmniExtensionProjectionEntity);
  }
  for (const foreignKey of foreignKeys) {
    ForeignKey(
      foreignKey.referencedTableName,
      foreignKey.columnNames as never,
      foreignKey.referencedColumnNames as never,
      { name: foreignKey.name, onDelete: foreignKey.onDelete },
    )(OmniExtensionProjectionEntity);
  }
  ForeignKey(
    () => OmniRecordEntity,
    [scopeColumn, identityColumn],
    ['scopeId', 'guid'],
    { onDelete: 'CASCADE' },
  )(OmniExtensionProjectionEntity);

  return OmniExtensionProjectionEntity as unknown as EntityTarget<Extension>;
}

/**
 * Creates reviewed-migration DDL for an extension table. Applications pass
 * the returned Table to QueryRunner.createTable; runtime CRUD never creates
 * schema objects. JSON storage remains a ProjectionDialect concern.
 */
export function createOmniExtensionProjectionTable(
  definition: OmniExtensionProjectionDefinition,
  dialect: ProjectionDialect,
): Table {
  const { columns, indices, foreignKeys } = extensionSchema(
    definition,
    dialect,
  );
  const scopeColumn = definition.scope.column;
  const identityColumn = definition.identity.column;

  return new Table({
    name: definition.tableName,
    columns: Object.entries(columns).map(([name, options]) => ({
      name,
      type: migrationColumnType(options.type),
      isPrimary: options.primary === true,
      isNullable: options.nullable === true,
      ...(options.length !== undefined
        ? { length: String(options.length) }
        : {}),
    })),
    indices: indices.map((index) => {
      if (!index.name || !Array.isArray(index.columns)) {
        throw new TypeError(
          'Omni extension projection indexes require a name and column list.',
        );
      }
      return {
        name: index.name,
        columnNames: index.columns,
        isUnique: index.unique === true,
        ...(index.where ? { where: index.where } : {}),
      };
    }),
    foreignKeys: [
      {
        columnNames: [scopeColumn, identityColumn],
        referencedTableName: 'omni-record',
        referencedColumnNames: ['scopeId', 'guid'],
        onDelete: 'CASCADE',
      },
      ...foreignKeys,
    ],
  });
}
