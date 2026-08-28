import type {
  EntitySchemaColumnOptions,
  EntitySchemaIndexOptions,
} from 'typeorm';
import type { ProjectionDialect } from './projection-dialect.js';
import {
  assertProjectionResourceDefinition,
  type ProjectionCodec,
  type ProjectionResourceDefinition,
} from './projection-resource.js';

export interface ProjectionSchemaOptions {
  columns: Record<string, EntitySchemaColumnOptions>;
  indices: EntitySchemaIndexOptions[];
}

function typeForCodec(
  codec: ProjectionCodec,
): StringConstructor | NumberConstructor {
  return codec === 'integer' ? Number : String;
}

/**
 * Derives the projection-owned TypeORM schema from its immutable definition.
 * A surrogate primary key remains an application storage choice; all public
 * scope, identity, revision, payload and projected column declarations live
 * in the projection contract.
 */
export function createProjectionSchemaOptions(
  definition: ProjectionResourceDefinition,
  dialect: ProjectionDialect,
): ProjectionSchemaOptions {
  assertProjectionResourceDefinition(definition);
  const columns: Record<string, EntitySchemaColumnOptions> = {
    [definition.scope.column]: { type: String, length: 64 },
    [definition.revision.column]: { type: Number, default: 1 },
    [definition.payload.column]: {
      type: dialect.payloadColumnType,
      nullable: false,
    },
  };

  for (const field of definition.fields) {
    if (field.storage !== 'column') continue;
    columns[field.column ?? field.name] = {
      type: typeForCodec(field.codec),
      nullable: field.nullable,
      ...(field.codec === 'string' || field.codec === 'instant'
        ? { length: 255 }
        : {}),
    };
  }

  return {
    columns,
    indices: definition.identity.uniqueWithinScope
      ? [
          {
            name: `${definition.tableName}_scope_${definition.identity.column}_unique`,
            columns: [definition.scope.column, definition.identity.column],
            unique: true,
          },
        ]
      : [],
  };
}
