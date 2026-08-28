import { describe, expect, it, jest } from '@jest/globals';
import type { DataSource, Repository } from 'typeorm';
import {
  createProjectionDialect,
  type ProjectionDialect,
} from '../projection/projection-dialect.js';
import {
  defineProjectionResource,
  getProjectionField,
  type ProjectionResourceDefinition,
} from '../projection/projection-resource.js';

type ProjectionRecord = {
  scopeId: string;
  guid: string;
  revision: number;
  owner?: string;
  payload: Record<string, unknown>;
};

const resource = defineProjectionResource({
  id: 'unit.projection.dialect.v1',
  tableName: 'unit_projection_dialect',
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
      query: { filter: ['eq'], sort: true },
    },
    {
      name: 'owner',
      storage: 'column',
      column: 'owner',
      codec: 'string',
      nullable: true,
      query: { filter: ['eq'], sort: true },
    },
    {
      name: 'priority',
      storage: 'json',
      path: ['workflow', 'priority'],
      codec: 'integer',
      nullable: true,
      query: { filter: ['eq', 'range'], sort: true },
      index: { name: 'unit_projection_priority_idx' },
    },
    {
      name: 'plannedEnd',
      storage: 'json',
      path: ['workflow', 'plannedEnd'],
      codec: 'instant',
      nullable: true,
      query: { filter: ['eq', 'range'], sort: true },
      index: { name: 'unit_projection_end_idx' },
    },
  ],
} satisfies ProjectionResourceDefinition);

function readRepository(records: ProjectionRecord[] = []) {
  const countQuery = { getCount: jest.fn(async () => records.length) };
  const query = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    clone: jest.fn(() => countQuery),
    getMany: jest.fn(async () => records),
  };
  return {
    query,
    countQuery,
    repository: {
      createQueryBuilder: jest.fn(() => query),
    } as unknown as Repository<ProjectionRecord>,
  };
}

function writeRepository(affected = 1) {
  const query = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    execute: jest.fn(async () => ({ affected })),
  };
  return {
    query,
    repository: {
      createQueryBuilder: jest.fn(() => query),
    } as unknown as Repository<ProjectionRecord>,
  };
}

describe('projection dialects', () => {
  it('recognizes only its scoped identity uniqueness failure', () => {
    const sqlite = createProjectionDialect('sqlite');
    const postgres = createProjectionDialect('postgres');

    expect(
      sqlite.isScopedIdentityConflict(
        {
          driverError: {
            code: 'SQLITE_CONSTRAINT',
            message:
              'UNIQUE constraint failed: unit_projection_dialect.scopeId, unit_projection_dialect.guid',
          },
        },
        resource,
      ),
    ).toBe(true);
    expect(
      sqlite.isScopedIdentityConflict(
        {
          driverError: {
            code: 'SQLITE_CONSTRAINT',
            message: 'UNIQUE constraint failed: another_table.guid',
          },
        },
        resource,
      ),
    ).toBe(false);
    expect(
      postgres.isScopedIdentityConflict(
        {
          driverError: {
            code: '23505',
            constraint: 'unit_projection_dialect_scope_guid_unique',
          },
        },
        resource,
      ),
    ).toBe(true);
    expect(
      postgres.isScopedIdentityConflict(
        {
          driverError: { code: '23505', constraint: 'unrelated_unique' },
        },
        resource,
      ),
    ).toBe(false);
  });

  it.each([
    [
      'sqlite',
      'CAST(json_extract("projection"."payload", \'$.workflow.priority\') AS BIGINT)',
    ],
    [
      'postgres',
      'CAST(("projection"."payload" #>> \'{workflow,priority}\') AS BIGINT)',
    ],
  ] as const)(
    'uses typed %s expressions consistently for reads, ordering, and indexes',
    async (driver, priorityExpression) => {
      const dialect = createProjectionDialect(driver);
      const { query, countQuery, repository } = readRepository([
        { scopeId: 'space-1', guid: 'record-1', revision: 1, payload: {} },
      ]);

      await expect(
        dialect.findMany(
          repository,
          resource,
          'space-1',
          [
            {
              field: getProjectionField(resource, 'owner'),
              operator: 'eq',
              values: ['alice'],
            },
            {
              field: getProjectionField(resource, 'priority'),
              operator: 'range',
              values: [1, 3],
            },
            {
              field: getProjectionField(resource, 'guid'),
              operator: 'in',
              values: ['record-1', 'record-2'],
            },
          ],
          [
            {
              field: getProjectionField(resource, 'priority'),
              direction: 'DESC',
            },
          ],
          { skip: 2, take: 3 },
        ),
      ).resolves.toEqual([
        [{ scopeId: 'space-1', guid: 'record-1', revision: 1, payload: {} }],
        1,
      ]);

      expect(query.where).toHaveBeenCalledWith(
        '"projection"."scopeId" = :projection_scope_id',
        {
          projection_scope_id: 'space-1',
        },
      );
      expect(query.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('"projection"."owner"'),
        { projection_filter_0: 'alice' },
      );
      expect(query.andWhere).toHaveBeenCalledWith(
        expect.stringContaining(`${priorityExpression} BETWEEN`),
        { projection_filter_1_from: 1, projection_filter_1_to: 3 },
      );
      expect(query.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('CAST("projection"."guid" AS TEXT) IN'),
        { projection_filter_2: ['record-1', 'record-2'] },
      );
      expect(query.addOrderBy).toHaveBeenCalledWith(priorityExpression, 'DESC');
      expect(query.addOrderBy).toHaveBeenCalledWith(
        '"projection"."guid"',
        'ASC',
      );
      expect(query.skip).toHaveBeenCalledWith(2);
      expect(query.take).toHaveBeenCalledWith(3);
      expect(countQuery.getCount).toHaveBeenCalledTimes(1);
      expect(dialect.compileIndexStatements(resource)).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            priorityExpression.replaceAll('"projection".', ''),
          ),
        ]),
      );
    },
  );

  it('does not add a duplicate identity sort when callers already declare it', async () => {
    const { query, repository } = readRepository();

    await createProjectionDialect('sqlite').findMany(
      repository,
      resource,
      'space-1',
      [],
      [{ field: getProjectionField(resource, 'guid'), direction: 'DESC' }],
      {},
    );

    expect(query.addOrderBy).toHaveBeenCalledTimes(1);
    expect(query.addOrderBy).toHaveBeenCalledWith(
      'CAST("projection"."guid" AS TEXT)',
      'DESC',
    );
  });

  it.each([
    ['sqlite', 'json_set(COALESCE("payload", \'{}\')', "'$.workflow.priority'"],
    [
      'postgres',
      'jsonb_typeof(COALESCE("payload", \'{}\'::jsonb))',
      "'{workflow,priority}'",
    ],
  ] as const)(
    'applies sibling-preserving %s JSON patches with an atomic revision predicate',
    async (driver, jsonExpression, path) => {
      const dialect = createProjectionDialect(driver);
      const { query, repository } = writeRepository();

      await expect(
        dialect.patch(repository, resource, {
          scopeId: 'space-1',
          guid: 'record-1',
          expectedRevision: 4,
          columnValues: { owner: 'alice' },
          jsonValues: [
            { field: getProjectionField(resource, 'priority'), value: 9 },
            {
              field: getProjectionField(resource, 'plannedEnd'),
              value: new Date('2032-03-04T05:06:07.000Z'),
            },
          ],
        }),
      ).resolves.toBe(1);

      const setValues = query.set.mock.calls[0][0] as Record<string, unknown>;
      expect(setValues.owner).toBe('alice');
      expect(setValues.revision).toEqual(expect.any(Function));
      expect(setValues.payload).toEqual(expect.any(Function));
      expect((setValues.payload as () => string)()).toContain(jsonExpression);
      expect((setValues.payload as () => string)()).toContain(path);
      expect(query.where).toHaveBeenCalledWith(
        expect.stringContaining('"scopeId" = :projection_scope_id'),
      );
      expect(query.setParameters).toHaveBeenCalledWith({
        projection_scope_id: 'space-1',
        projection_guid: 'record-1',
        projection_expected_revision: 4,
        projection_json_0: '9',
        projection_json_1: '"2032-03-04T05:06:07.000Z"',
      });
    },
  );

  it('rejects non-JSON patch declarations before compiling SQL', async () => {
    const { repository } = writeRepository();

    await expect(
      createProjectionDialect('sqlite').patch(repository, resource, {
        scopeId: 'space-1',
        guid: 'record-1',
        expectedRevision: 1,
        columnValues: {},
        jsonValues: [
          { field: getProjectionField(resource, 'owner'), value: 'alice' },
        ],
      }),
    ).rejects.toThrow('cannot be patched as JSON');
  });

  it('normalizes missing PostgreSQL JSON object ancestors before a deep patch', async () => {
    const { query, repository } = writeRepository();
    const deepResource = defineProjectionResource({
      ...resource,
      fields: resource.fields.map((field) =>
        field.name === 'plannedEnd'
          ? { ...field, path: ['workflow', 'plan', 'end'] }
          : field,
      ),
    });

    await createProjectionDialect('postgres').patch(repository, deepResource, {
      scopeId: 'space-1',
      guid: 'record-1',
      expectedRevision: 1,
      columnValues: {},
      jsonValues: [
        {
          field: getProjectionField(deepResource, 'plannedEnd'),
          value: '2032-03-04T05:06:07.000Z',
        },
      ],
    });

    const setValues = query.set.mock.calls[0][0] as Record<string, unknown>;
    const expression = (setValues.payload as () => string)();
    expect(expression).toContain('jsonb_typeof');
    expect(expression).toContain("'{workflow}'");
    expect(expression).toContain("'{workflow,plan}'");
    expect(expression).toContain("'{workflow,plan,end}'");
  });

  it.each([
    ['sqlite', 'sqlite-json1', ['unit_projection_priority_idx'], true],
    ['postgres', 'jsonb', ['unit_projection_priority_idx'], true],
  ] as const)(
    'inspects %s storage and indexes through its dialect adapter',
    async (driver, storage, indexes, validJson) => {
      const query = jest
        .fn()
        .mockResolvedValueOnce(
          driver === 'sqlite'
            ? [{ name: 'unit_projection_priority_idx' }]
            : [{ data_type: 'jsonb' }],
        )
        .mockResolvedValueOnce(
          driver === 'sqlite'
            ? [{ valid_json: 1 }]
            : [{ indexname: 'unit_projection_priority_idx' }],
        );

      await expect(
        createProjectionDialect(driver).inspect(
          { query } as unknown as DataSource,
          resource,
        ),
      ).resolves.toEqual({ payloadStorage: storage, indexes, validJson });
    },
  );

  it.each([
    [
      'sqlite',
      'SEARCH unit_projection_dialect USING INDEX unit_projection_priority_idx',
    ],
    ['postgres', 'Index Scan using unit_projection_priority_idx'],
  ] as const)(
    'explains indexed equality through %s without leaking SQL to consumers',
    async (driver, planLine) => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ plan: planLine }]);
      const dialect = createProjectionDialect(driver);

      await expect(
        dialect.explainIndexedEquality(
          { query } as unknown as DataSource,
          resource,
          getProjectionField(resource, 'priority'),
          'space-1',
          3,
        ),
      ).resolves.toEqual({ lines: [planLine], usesDeclaredIndex: true });
      expect(query.mock.calls[0][0]).toContain('ANALYZE');
      expect(query.mock.calls[1][0]).toContain(
        driver === 'sqlite' ? 'EXPLAIN QUERY PLAN' : 'EXPLAIN SELECT',
      );
    },
  );

  it('fails closed for undeclared indexes and unknown database drivers', async () => {
    const dialect: ProjectionDialect = createProjectionDialect('sqlite');

    await expect(
      dialect.explainIndexedEquality(
        { query: jest.fn() } as unknown as DataSource,
        resource,
        getProjectionField(resource, 'owner'),
        'space-1',
        'alice',
      ),
    ).rejects.toThrow('has no declared index');
    expect(() => createProjectionDialect('mysql')).toThrow(
      'Unsupported projection dialect',
    );
  });
});
