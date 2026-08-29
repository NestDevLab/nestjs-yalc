import { describe, expect, it } from '@jest/globals';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar.js';
import { createProjectionDialect } from '../projection/projection-dialect.js';
import { createProjectionGraphqlTypes } from '../projection/projection-graphql.js';
import { createProjectionSchemaOptions } from '../projection/projection-schema.js';
import {
  assertProjectionCodecValue,
  assertProjectionPayloadValue,
  compileProjectionUniqueConstraintPredicate,
  defineProjectionResource,
  getProjectionField,
  getProjectionPathValue,
  getProjectionReferenceColumnNames,
  getProjectionReferenceIndexName,
  getProjectionReferenceTargetColumnNames,
  getProjectionUniqueConstraintColumnNames,
  normalizeProjectionCodecValue,
  PROJECTION_INTEGER_MAX,
  PROJECTION_INTEGER_MIN,
  setProjectionPathValue,
  type ProjectionFieldDefinition,
  type ProjectionResourceDefinition,
} from '../projection/projection-resource.js';
import { getModelFieldMetadataList } from '../object.decorator.js';

const definition = (
  field: ProjectionFieldDefinition,
): ProjectionResourceDefinition => ({
  id: 'projection.unit.record.v1',
  tableName: 'projection_unit_record',
  identity: { column: 'guid', uniqueWithinScope: true },
  scope: { column: 'scopeId', serverOwned: true },
  revision: { column: 'revision' },
  payload: { column: 'payload', allowCreate: true },
  deletion: 'hard',
  fields: [
    {
      name: 'guid',
      storage: 'column',
      column: 'guid',
      codec: 'string',
      nullable: false,
      requiredOnCreate: true,
    },
    field,
  ],
});

const priorityField: ProjectionFieldDefinition = {
  name: 'priority',
  storage: 'json',
  path: ['workflow', 'priority'],
  codec: 'integer',
  nullable: true,
  query: { filter: ['eq', 'range'], sort: true },
  index: { name: 'projection_unit_priority_idx' },
};

const uuidDefinition = (): ProjectionResourceDefinition => ({
  id: 'projection.unit.uuid.v1',
  tableName: 'projection_unit_uuid',
  identity: { column: 'guid', uniqueWithinScope: true },
  scope: { column: 'scopeId', serverOwned: true },
  revision: { column: 'revision' },
  payload: { column: 'payload', allowCreate: true },
  deletion: 'hard',
  fields: [
    {
      name: 'guid',
      storage: 'column',
      column: 'guid',
      codec: 'uuid',
      nullable: false,
      requiredOnCreate: true,
      query: { filter: ['eq'], sort: true },
    },
    {
      name: 'externalRefId',
      storage: 'json',
      path: ['externalRefId'],
      codec: 'uuid',
      nullable: false,
      requiredOnCreate: true,
      query: { filter: ['eq'], sort: true },
      index: { name: 'projection_unit_external_ref_idx' },
    },
  ],
});

const constrainedDefinition = (): ProjectionResourceDefinition => ({
  id: 'projection.unit.constraints.v1',
  tableName: 'projection_unit_constraints',
  identity: { column: 'guid', uniqueWithinScope: true },
  scope: { column: 'scopeId', serverOwned: true },
  revision: { column: 'revision' },
  payload: { column: 'payload', allowCreate: true },
  deletion: 'hard',
  fields: [
    {
      name: 'guid',
      storage: 'column',
      column: 'guid',
      codec: 'uuid',
      nullable: false,
      requiredOnCreate: true,
    },
    {
      name: 'parentGuid',
      storage: 'column',
      column: 'parent_guid',
      codec: 'uuid',
      nullable: true,
    },
    {
      name: 'kind',
      storage: 'column',
      column: 'kind',
      codec: 'string',
      nullable: false,
      requiredOnCreate: true,
    },
    {
      name: 'isInitial',
      storage: 'column',
      column: 'is_initial',
      codec: 'boolean',
      nullable: false,
      requiredOnCreate: true,
      query: { filter: ['eq'], sort: true },
    },
    {
      name: 'state',
      storage: 'column',
      column: 'state',
      codec: 'string',
      nullable: false,
      requiredOnCreate: true,
    },
  ],
  references: [
    {
      name: 'projection_unit_parent',
      fields: ['parentGuid'],
      target: {
        tableName: 'projection_unit_parent',
        scopeColumn: 'scopeId',
        identityColumns: ['guid'],
      },
      onDelete: 'RESTRICT',
    },
  ],
  uniqueConstraints: [
    {
      name: 'projection_unit_initial_kind_unique',
      fields: ['kind'],
      predicate: { isInitial: true, state: 'active' },
    },
  ],
});

describe('projection resource contract', () => {
  it('freezes a valid portable nested path contract', () => {
    const result = defineProjectionResource(definition(priorityField));

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.fields)).toBe(true);
    expect(result.fields[1].path).toEqual(['workflow', 'priority']);
  });

  it('requires a stable non-empty resource id', () => {
    const resource = definition(priorityField);
    resource.id = '';

    expect(() => defineProjectionResource(resource)).toThrow(
      'Projection resource id must be a non-empty identifier',
    );
  });

  it.each([
    [[], 'non-empty path'],
    [["quote'"], 'invalid path segment'],
    [['comma,value'], 'invalid path segment'],
    [['dot.value'], 'invalid path segment'],
    [['bracket[value]'], 'invalid path segment'],
    [['$root'], 'invalid path segment'],
  ] as const)(
    'rejects unsafe JSON path %j before SQL',
    (path, expectedMessage) => {
      expect(() =>
        defineProjectionResource(definition({ ...priorityField, path })),
      ).toThrow(expectedMessage);
    },
  );

  it('derives GraphQL and physical schema shape from the same contract', () => {
    const resource = defineProjectionResource(definition(priorityField));
    const types = createProjectionGraphqlTypes(resource, {
      object: 'ProjectionUnitRecord',
      create: 'ProjectionUnitRecordCreate',
      patch: 'ProjectionUnitRecordPatch',
      conditions: 'ProjectionUnitRecordCondition',
    });
    const sqliteSchema = createProjectionSchemaOptions(
      resource,
      createProjectionDialect('sqlite'),
    );
    const postgresSchema = createProjectionSchemaOptions(
      resource,
      createProjectionDialect('postgres'),
    );

    expect(Object.keys(getModelFieldMetadataList(types.object)!)).toEqual([
      'guid',
      'priority',
      'revision',
      'payload',
    ]);
    expect(getModelFieldMetadataList(types.create)).toHaveProperty('guid');
    expect(getModelFieldMetadataList(types.patch)).not.toHaveProperty('guid');
    expect(getModelFieldMetadataList(types.patch)).toHaveProperty('priority');
    expect(getModelFieldMetadataList(types.create)).toHaveProperty('payload');
    expect(getModelFieldMetadataList(types.patch)).not.toHaveProperty(
      'payload',
    );
    expect(sqliteSchema.columns.payload.type).toBe('simple-json');
    expect(postgresSchema.columns.payload.type).toBe('jsonb');
    expect(sqliteSchema.columns.priority).toBeUndefined();
    expect(sqliteSchema.indices[0]).toMatchObject({
      columns: ['scopeId', 'guid'],
      unique: true,
    });
  });

  it('derives UUID GraphQL fields and portable schema from the same contract', () => {
    const resource = defineProjectionResource(uuidDefinition());
    const types = createProjectionGraphqlTypes(resource, {
      object: 'ProjectionUuidRecord',
      create: 'ProjectionUuidRecordCreate',
      patch: 'ProjectionUuidRecordPatch',
      conditions: 'ProjectionUuidRecordCondition',
    });
    const sqliteSchema = createProjectionSchemaOptions(
      resource,
      createProjectionDialect('sqlite'),
    );
    const postgresSchema = createProjectionSchemaOptions(
      resource,
      createProjectionDialect('postgres'),
    );
    const objectFields = getModelFieldMetadataList(types.object)!;
    const createFields = getModelFieldMetadataList(types.create)!;
    const patchFields = getModelFieldMetadataList(types.patch)!;
    const conditionFields = getModelFieldMetadataList(types.conditions)!;

    expect(objectFields.guid.gqlType!()).toBe(UUIDScalar);
    expect(objectFields.externalRefId.gqlType!()).toBe(UUIDScalar);
    expect(createFields.guid.gqlType!()).toBe(UUIDScalar);
    expect(createFields.externalRefId.gqlType!()).toBe(UUIDScalar);
    expect(patchFields.guid).toBeUndefined();
    expect(patchFields.externalRefId.gqlType!()).toBe(UUIDScalar);
    expect(conditionFields.guid.gqlType!()).toBe(UUIDScalar);
    expect(sqliteSchema.columns.guid).toMatchObject({
      type: String,
      length: 255,
    });
    expect(postgresSchema.columns.guid).toMatchObject({
      type: String,
      length: 255,
    });
  });

  it('derives generic same-scope constraints and boolean transport metadata', () => {
    const resource = defineProjectionResource(constrainedDefinition());
    const reference = resource.references![0]!;
    const constraint = resource.uniqueConstraints![0]!;
    const graphql = createProjectionGraphqlTypes(resource, {
      object: 'ProjectionConstraintRecord',
      create: 'ProjectionConstraintRecordCreate',
      patch: 'ProjectionConstraintRecordPatch',
      conditions: 'ProjectionConstraintRecordCondition',
    });

    expect(getProjectionReferenceIndexName(reference)).toBe(
      'projection_unit_parent_idx',
    );
    expect(getProjectionReferenceColumnNames(resource, reference)).toEqual([
      'scopeId',
      'parent_guid',
    ]);
    expect(getProjectionReferenceTargetColumnNames(reference)).toEqual([
      'scopeId',
      'guid',
    ]);
    expect(getProjectionUniqueConstraintColumnNames(resource, constraint)).toEqual([
      'scopeId',
      'kind',
    ]);
    expect(
      compileProjectionUniqueConstraintPredicate(resource, constraint, 'sqlite'),
    ).toBe('"is_initial" = 1 AND "state" = \'active\'');
    expect(
      compileProjectionUniqueConstraintPredicate(
        resource,
        constraint,
        'postgres',
      ),
    ).toBe('"is_initial" = TRUE AND "state" = \'active\'');
    expect(
      getModelFieldMetadataList(graphql.object)!.isInitial.gqlType!(),
    ).toBe(Boolean);
    expect(
      createProjectionSchemaOptions(
        resource,
        createProjectionDialect('sqlite'),
      ).columns.is_initial.type,
    ).toBe(Boolean);

    const booleanField = getProjectionField(resource, 'isInitial');
    expect(() => assertProjectionCodecValue(booleanField, true)).not.toThrow();
    expect(() => assertProjectionCodecValue(booleanField, false)).not.toThrow();
    expect(() => assertProjectionCodecValue(booleanField, 'true')).toThrow(
      'must be a boolean',
    );
    expect(() => assertProjectionCodecValue(booleanField, null)).toThrow(
      'cannot be null',
    );
  });

  it.each([
    [
      'an undeclared reference field',
      (resource: ProjectionResourceDefinition) => {
        resource.references![0]!.fields = ['missing'];
      },
      'is not a declared projection field',
    ],
    [
      'an invalid reference delete action',
      (resource: ProjectionResourceDefinition) => {
        resource.references![0]!.onDelete = 'CASCADE' as never;
      },
      'only supports RESTRICT or NO ACTION',
    ],
    [
      'a reference target identity count mismatch',
      (resource: ProjectionResourceDefinition) => {
        resource.references![0]!.target.identityColumns = ['guid', 'other'];
      },
      'local and target identity column counts must match',
    ],
    [
      'a partial constraint with no predicate',
      (resource: ProjectionResourceDefinition) => {
        resource.uniqueConstraints![0]!.predicate = {};
      },
      'requires at least one predicate field',
    ],
    [
      'a partial constraint predicate with an invalid boolean',
      (resource: ProjectionResourceDefinition) => {
        resource.uniqueConstraints![0]!.predicate = { isInitial: 'true' } as never;
      },
      'must be a boolean',
    ],
    [
      'a duplicated reference and unique-constraint name',
      (resource: ProjectionResourceDefinition) => {
        resource.uniqueConstraints![0]!.name = resource.references![0]!.name;
      },
      'reference and unique constraint names must be distinct',
    ],
  ] as const)(
    'rejects %s',
    (_label, mutate, expectedMessage) => {
      const resource = constrainedDefinition();
      mutate(resource);

      expect(() => defineProjectionResource(resource)).toThrow(expectedMessage);
    },
  );

  it('rejects undeclared constraints and unsupported predicate dialects', () => {
    const resource = defineProjectionResource(constrainedDefinition());
    const constraint = resource.uniqueConstraints![0]!;

    expect(() =>
      compileProjectionUniqueConstraintPredicate(
        resource,
        { ...constraint, name: 'missing_constraint' },
        'sqlite',
      ),
    ).toThrow('is not declared by the resource');
    expect(() =>
      compileProjectionUniqueConstraintPredicate(
        resource,
        constraint,
        'mysql' as never,
      ),
    ).toThrow('Unsupported projection predicate dialect');
  });

  it('fails closed when a JSON codec declares query capabilities', () => {
    expect(() =>
      defineProjectionResource(
        definition({
          ...priorityField,
          codec: 'json',
          query: { filter: ['eq'], sort: true },
        }),
      ),
    ).toThrow('cannot be filtered, sorted, or indexed');
  });

  it.each([
    [
      { ...priorityField, name: 'guid' },
      'Projection field guid is declared twice',
    ],
    [
      {
        ...priorityField,
        storage: 'column',
        column: undefined,
        path: undefined,
      },
      'must be a non-empty identifier',
    ],
    [
      { ...priorityField, storage: 'column', column: 'priority' },
      'cannot declare a JSON path',
    ],
    [{ ...priorityField, column: 'priority' }, 'cannot declare a column'],
    [{ ...priorityField, storage: 'external' }, 'unsupported storage mode'],
    [{ ...priorityField, codec: 'decimal' }, 'unsupported codec'],
    [
      {
        ...priorityField,
        storage: 'column',
        column: 'priority',
        path: undefined,
        codec: 'json',
        query: undefined,
        index: undefined,
      },
      'must use JSON storage',
    ],
    [
      { ...priorityField, query: { filter: ['contains'] } },
      'unsupported filter',
    ],
    [
      { ...priorityField, codec: 'string', query: { filter: ['range'] } },
      'cannot declare range filtering',
    ],
    [{ ...priorityField, index: { name: '' } }, 'non-empty identifier'],
  ] as const)('rejects an invalid field contract %#', (field, message) => {
    expect(() =>
      defineProjectionResource(
        definition(field as unknown as ProjectionFieldDefinition),
      ),
    ).toThrow(message);
  });

  it('requires scoped identity uniqueness', () => {
    const resource = definition(priorityField);
    resource.identity.uniqueWithinScope = false as true;

    expect(() => defineProjectionResource(resource)).toThrow(
      'uniqueness within its server-owned scope',
    );
  });

  it.each([
    [
      'a tombstone deletion policy',
      (resource: ProjectionResourceDefinition) => {
        resource.deletion = 'tombstone' as never;
      },
      'only supports hard deletion',
    ],
    [
      'a caller-owned scope',
      (resource: ProjectionResourceDefinition) => {
        resource.scope.serverOwned = false as true;
      },
      'must be server-owned',
    ],
    [
      'a raw payload patch flag',
      (resource: ProjectionResourceDefinition) => {
        (resource.payload as Record<string, unknown>).allowPatch = true;
      },
      'updates are not supported',
    ],
    [
      'a payload storage column with no matching public field',
      (resource: ProjectionResourceDefinition) => {
        resource.payload.column = 'document';
      },
      'must be named payload',
    ],
    [
      'a missing identity field',
      (resource: ProjectionResourceDefinition) => {
        resource.fields = [priorityField];
      },
      'must be a required non-null string or UUID column field',
    ],
    [
      'a client-visible scope field',
      (resource: ProjectionResourceDefinition) => {
        resource.fields = [
          ...resource.fields,
          {
            name: 'scopeId',
            storage: 'column',
            column: 'scopeId',
            codec: 'string',
            nullable: false,
          },
        ];
      },
      'collides with a reserved public field',
    ],
    [
      'a projected field named payload',
      (resource: ProjectionResourceDefinition) => {
        resource.fields = resource.fields.map((field) =>
          field.name === 'priority' ? { ...field, name: 'payload' } : field,
        );
      },
      'collides with a reserved public field',
    ],
    [
      'a projected field named revision',
      (resource: ProjectionResourceDefinition) => {
        resource.fields = resource.fields.map((field) =>
          field.name === 'priority' ? { ...field, name: 'revision' } : field,
        );
      },
      'collides with a reserved public field',
    ],
    [
      'a projected field named expectedRevision',
      (resource: ProjectionResourceDefinition) => {
        resource.fields = resource.fields.map((field) =>
          field.name === 'priority'
            ? { ...field, name: 'expectedRevision' }
            : field,
        );
      },
      'collides with a reserved public field',
    ],
    [
      'a column that collides with payload storage',
      (resource: ProjectionResourceDefinition) => {
        resource.fields = resource.fields.map((field) =>
          field.name === 'priority'
            ? {
                ...field,
                storage: 'column' as const,
                column: 'payload',
                path: undefined,
              }
            : field,
        );
      },
      'collides with a reserved column',
    ],
    [
      'duplicate expression index names',
      (resource: ProjectionResourceDefinition) => {
        resource.fields = [
          ...resource.fields,
          {
            ...priorityField,
            name: 'secondaryPriority',
            path: ['workflow', 'secondaryPriority'],
          },
        ];
      },
      'is declared twice',
    ],
    [
      'an expression index name reserved for scoped identity',
      (resource: ProjectionResourceDefinition) => {
        resource.fields = resource.fields.map((field) =>
          field.name === 'priority'
            ? {
                ...field,
                index: { name: 'projection_unit_record_scope_guid_unique' },
              }
            : field,
        );
      },
      'collides with the scoped identity index',
    ],
    [
      'overlapping JSON paths',
      (resource: ProjectionResourceDefinition) => {
        resource.fields = [
          ...resource.fields,
          {
            name: 'workflow',
            storage: 'json',
            path: ['workflow'],
            codec: 'json',
            nullable: true,
          },
        ];
      },
      'overlaps',
    ],
    [
      'a nullable required-on-create field',
      (resource: ProjectionResourceDefinition) => {
        resource.fields = resource.fields.map((field) =>
          field.name === 'priority'
            ? { ...field, nullable: true, requiredOnCreate: true }
            : field,
        );
      },
      'cannot be both required on create and nullable',
    ],
    [
      'a non-null field that is optional on create',
      (resource: ProjectionResourceDefinition) => {
        resource.fields = resource.fields.map((field) =>
          field.name === 'priority'
            ? { ...field, nullable: false, requiredOnCreate: undefined }
            : field,
        );
      },
      'must be required on create',
    ],
  ] as const)('fails closed for %s', (_label, mutate, expectedMessage) => {
    const resource = definition(priorityField);
    mutate(resource);

    expect(() => defineProjectionResource(resource)).toThrow(expectedMessage);
  });

  it('normalizes canonical instants and rejects invalid codec values', () => {
    const instantField: ProjectionFieldDefinition = {
      ...priorityField,
      name: 'plannedEnd',
      path: ['workflow', 'plannedEnd'],
      codec: 'instant',
    };

    expect(
      normalizeProjectionCodecValue(
        instantField,
        new Date('2030-01-02T03:04:05.000Z'),
      ),
    ).toBe('2030-01-02T03:04:05.000Z');
    expect(() =>
      normalizeProjectionCodecValue(instantField, '2030-01-02'),
    ).toThrow('canonical UTC ISO timestamp');
    expect(() => normalizeProjectionCodecValue(priorityField, '10')).toThrow(
      'signed 32-bit integer',
    );
    expect(() =>
      normalizeProjectionCodecValue(instantField, new Date('invalid')),
    ).toThrow('valid Date');
  });

  it('accepts only canonical UUID values', () => {
    const uuidField: ProjectionFieldDefinition = {
      name: 'externalRefId',
      storage: 'json',
      path: ['externalRefId'],
      codec: 'uuid',
      nullable: false,
    };

    expect(() =>
      assertProjectionCodecValue(
        uuidField,
        '123e4567-e89b-12d3-a456-426614174000',
      ),
    ).not.toThrow();
    expect(() =>
      assertProjectionCodecValue(
        uuidField,
        '123E4567-E89B-12D3-A456-426614174000',
      ),
    ).toThrow('canonical UUID');
    expect(() =>
      assertProjectionCodecValue(
        uuidField,
        '123e4567-e89b-12d3-a456-not-a-uuid',
      ),
    ).toThrow('canonical UUID');
    expect(() => assertProjectionCodecValue(uuidField, 1)).toThrow(
      'canonical UUID',
    );
  });

  it('bounds portable integers to the GraphQL and PostgreSQL int32 range', () => {
    expect(() =>
      assertProjectionCodecValue(priorityField, PROJECTION_INTEGER_MIN),
    ).not.toThrow();
    expect(() =>
      assertProjectionCodecValue(priorityField, PROJECTION_INTEGER_MAX),
    ).not.toThrow();
    expect(() =>
      assertProjectionCodecValue(priorityField, PROJECTION_INTEGER_MIN - 1),
    ).toThrow('signed 32-bit integer');
    expect(() =>
      assertProjectionCodecValue(priorityField, PROJECTION_INTEGER_MAX + 1),
    ).toThrow('signed 32-bit integer');
  });

  it('enforces nullable, scalar, and JSON codec semantics', () => {
    const requiredString: ProjectionFieldDefinition = {
      name: 'title',
      storage: 'json',
      path: ['title'],
      codec: 'string',
      nullable: false,
    };
    const jsonField: ProjectionFieldDefinition = {
      name: 'metadata',
      storage: 'json',
      path: ['metadata'],
      codec: 'json',
      nullable: true,
    };

    expect(() => assertProjectionCodecValue(requiredString, null)).toThrow(
      'cannot be null',
    );
    expect(() => assertProjectionCodecValue(requiredString, 1)).toThrow(
      'must be a string',
    );
    expect(() => assertProjectionCodecValue(jsonField, undefined)).toThrow(
      'JSON-compatible value',
    );
    expect(() => assertProjectionCodecValue(jsonField, Number.NaN)).toThrow(
      'JSON-compatible value',
    );
    expect(() => assertProjectionCodecValue(jsonField, new Date())).toThrow(
      'JSON-compatible value',
    );

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => assertProjectionCodecValue(jsonField, cyclic)).toThrow(
      'JSON-compatible value',
    );
    expect(() =>
      assertProjectionCodecValue(jsonField, {
        enabled: true,
        retries: 2,
        labels: ['one', null],
      }),
    ).not.toThrow();
    expect(() => assertProjectionCodecValue(jsonField, null)).not.toThrow();
  });

  it('treats raw payload as a create-only JSON object', () => {
    const resource = defineProjectionResource(definition(priorityField));
    const noPayloadInput = createProjectionGraphqlTypes(
      defineProjectionResource({
        ...definition(priorityField),
        payload: { column: 'payload', allowCreate: false },
      }),
      {
        object: 'ProjectionNoPayload',
        create: 'ProjectionNoPayloadCreate',
        patch: 'ProjectionNoPayloadPatch',
        conditions: 'ProjectionNoPayloadCondition',
      },
    );

    expect(Object.isFrozen(resource)).toBe(true);
    expect(getModelFieldMetadataList(noPayloadInput.object)).toHaveProperty(
      'payload',
    );
    expect(getModelFieldMetadataList(noPayloadInput.create)).not.toHaveProperty(
      'payload',
    );
    expect(getModelFieldMetadataList(noPayloadInput.patch)).not.toHaveProperty(
      'payload',
    );
    expect(() => assertProjectionPayloadValue([])).toThrow('JSON object');
    expect(() =>
      assertProjectionPayloadValue({ createdAt: new Date() }),
    ).toThrow('JSON-compatible');
    expect(() =>
      assertProjectionPayloadValue({ nested: { values: [1, true, null] } }),
    ).not.toThrow();
  });

  it('reads, replaces, and preserves nested projection paths immutably', () => {
    const payload = {
      workflow: { priority: 2, sibling: 'kept' },
      untouched: true,
    };

    expect(getProjectionField(definition(priorityField), 'priority')).toEqual(
      priorityField,
    );
    expect(() =>
      getProjectionField(definition(priorityField), 'missing'),
    ).toThrow('Unknown projection field');
    expect(getProjectionPathValue(payload, ['workflow', 'priority'])).toBe(2);
    expect(
      getProjectionPathValue({ workflow: [] }, ['workflow', 'priority']),
    ).toBeUndefined();

    const updated = setProjectionPathValue(
      payload,
      ['workflow', 'priority'],
      10,
    );
    expect(updated).toEqual({
      workflow: { priority: 10, sibling: 'kept' },
      untouched: true,
    });
    expect(payload.workflow.priority).toBe(2);
    expect(
      setProjectionPathValue(
        { workflow: 'legacy' },
        ['workflow', 'priority'],
        3,
      ),
    ).toEqual({ workflow: { priority: 3 } });
  });

  it.each([
    [
      'sqlite',
      'CAST(json_extract("payload", \'$.workflow.priority\') AS BIGINT)',
    ],
    ['postgres', 'CAST(("payload" #>> \'{workflow,priority}\') AS BIGINT)'],
  ] as const)(
    'uses the codec expression in the %s index definition',
    async (driver, expression) => {
      const statements = createProjectionDialect(driver).compileIndexStatements(
        defineProjectionResource(definition(priorityField)),
      );

      expect(statements).toEqual([expect.stringContaining(expression)]);
    },
  );
});
