import { describe, expect, it, jest } from '@jest/globals';
import { Between, Equal, In } from 'typeorm';
import type { YalcEventService } from '@nestjs-yalc/event-manager';
import type { Repository } from 'typeorm';
import { createProjectionDialect } from '../projection/projection-dialect.js';
import type { ProjectionDialect } from '../projection/projection-dialect.js';
import {
  defineProjectionResource,
  PROJECTION_INTEGER_MAX,
  type ProjectionResourceDefinition,
} from '../projection/projection-resource.js';
import {
  ProjectionResourceService,
  type ProjectionScope,
} from '../projection/projection.service.js';

type ProjectionRecord = {
  scopeId: string;
  guid: string;
  revision: number;
  payload?: Record<string, unknown>;
  title?: string;
};

const resource = defineProjectionResource({
  id: 'unit.projection.record.v1',
  tableName: 'unit_projection_record',
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
      name: 'title',
      storage: 'json',
      path: ['workflow', 'title'],
      codec: 'string',
      nullable: false,
      requiredOnCreate: true,
      query: { filter: ['eq'], sort: true },
    },
    {
      name: 'priority',
      storage: 'json',
      path: ['workflow', 'priority'],
      codec: 'integer',
      nullable: true,
      query: { filter: ['eq', 'range'], sort: true },
    },
    {
      name: 'plannedEnd',
      storage: 'json',
      path: ['workflow', 'plannedEnd'],
      codec: 'instant',
      nullable: true,
      query: { filter: ['eq', 'range'], sort: true },
    },
    {
      name: 'metadata',
      storage: 'json',
      path: ['metadata'],
      codec: 'json',
      nullable: true,
    },
  ],
} satisfies ProjectionResourceDefinition);

const uuidResource = defineProjectionResource({
  ...resource,
  id: 'unit.projection.uuid-record.v1',
  tableName: 'unit_projection_uuid_record',
  fields: [
    { ...resource.fields[0], codec: 'uuid' },
    ...resource.fields.slice(1),
    {
      name: 'externalRefId',
      storage: 'json',
      path: ['externalRefId'],
      codec: 'uuid',
      nullable: false,
      requiredOnCreate: true,
      query: { filter: ['eq'], sort: true },
      index: { name: 'unit_projection_uuid_external_ref_idx' },
    },
  ],
} satisfies ProjectionResourceDefinition);

function failureEvents(): YalcEventService {
  const exception = (message: string): Error => new Error(message);
  return {
    errorBadRequest: jest.fn((_code, options) =>
      exception(
        (options as { response: { message: string } }).response.message,
      ),
    ),
    errorNotFound: jest.fn((_code, options) =>
      exception(
        (options as { response: { message: string } }).response.message,
      ),
    ),
    errorConflict: jest.fn((_code, options) =>
      exception(
        (options as { response: { message: string } }).response.message,
      ),
    ),
  } as unknown as YalcEventService;
}

function testService(
  options: {
    dialect?: Partial<ProjectionDialect>;
    repository?: Partial<Repository<ProjectionRecord>>;
    definition?: ProjectionResourceDefinition;
  } = {},
) {
  const repository = {
    create: jest.fn((value: ProjectionRecord) => value),
    save: jest.fn(async (value: ProjectionRecord) => value),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    delete: jest.fn(),
    ...options.repository,
  } as unknown as Repository<ProjectionRecord>;
  const dialect = {
    ...createProjectionDialect('sqlite'),
    findMany: jest.fn(async () => [[], 0] as [ProjectionRecord[], number]),
    patch: jest.fn(async () => 1),
    ...options.dialect,
  } as ProjectionDialect;
  const scope: ProjectionScope = {
    scopeId: 'space-1',
    cacheKey: (key) => `space-1:${key}`,
  };
  const events = failureEvents();

  return {
    repository,
    dialect,
    events,
    service: new ProjectionResourceService(
      repository,
      scope,
      dialect,
      events,
      options.definition ?? resource,
    ),
  };
}

describe('ProjectionResourceService', () => {
  it('creates a server-scoped record and preserves raw payload siblings', async () => {
    const { repository, service } = testService();
    const plannedEnd = new Date('2031-02-03T04:05:06.000Z');

    const created = await service.createEntity({
      guid: 'record-1',
      title: 'First record',
      priority: 3,
      plannedEnd,
      metadata: { labels: ['blue'] },
      payload: { workflow: { sibling: 'kept' }, raw: true },
    });

    expect(repository.create).toHaveBeenCalledWith({
      scopeId: 'space-1',
      guid: 'record-1',
      revision: 1,
      payload: {
        workflow: {
          sibling: 'kept',
          title: 'First record',
          priority: 3,
          plannedEnd: '2031-02-03T04:05:06.000Z',
        },
        metadata: { labels: ['blue'] },
        raw: true,
      },
    });
    expect(created).toMatchObject({
      guid: 'record-1',
      title: 'First record',
      priority: 3,
      plannedEnd: '2031-02-03T04:05:06.000Z',
      metadata: { labels: ['blue'] },
    });
  });

  it('maps only the scoped identity uniqueness failure to a conflict', async () => {
    const duplicate = new Error('duplicate identity');
    const unrelated = new Error('unrelated persistence failure');
    const isScopedIdentityConflict = jest.fn(
      (error: unknown) => error === duplicate,
    );
    const duplicateService = testService({
      dialect: { isScopedIdentityConflict },
      repository: { save: jest.fn(async () => Promise.reject(duplicate)) },
    });

    await expect(
      duplicateService.service.createEntity({
        guid: 'record-1',
        title: 'Title',
      }),
    ).rejects.toThrow('already exists in this scope');
    expect(isScopedIdentityConflict).toHaveBeenCalledWith(duplicate, resource);

    const unrelatedService = testService({
      dialect: { isScopedIdentityConflict },
      repository: { save: jest.fn(async () => Promise.reject(unrelated)) },
    });
    await expect(
      unrelatedService.service.createEntity({
        guid: 'record-2',
        title: 'Title',
      }),
    ).rejects.toBe(unrelated);
  });

  it('rejects unknown, invalid, and client-supplied scope create input', async () => {
    const { repository, service } = testService();

    await expect(
      service.createEntity({
        guid: 'record-1',
        title: 'Title',
        scopeId: 'other',
      }),
    ).rejects.toThrow('scopeId is not writable');
    await expect(
      service.createEntity({ guid: 'record-1', priority: 1 }),
    ).rejects.toThrow('title is required on create');
    await expect(
      service.createEntity({ guid: 'record-1', title: null }),
    ).rejects.toThrow('title cannot be null');
    await expect(
      service.createEntity({ guid: 'record-1', title: 'Title', payload: [] }),
    ).rejects.toThrow('JSON object');

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    await expect(
      service.createEntity({
        guid: 'record-1',
        title: 'Title',
        payload: { createdAt: new Date('2031-02-03T04:05:06.000Z') },
      }),
    ).rejects.toThrow('JSON-compatible');
    await expect(
      service.createEntity({
        guid: 'record-1',
        title: 'Title',
        payload: { omitted: undefined },
      }),
    ).rejects.toThrow('JSON-compatible');
    await expect(
      service.createEntity({
        guid: 'record-1',
        title: 'Title',
        payload: cyclic,
      }),
    ).rejects.toThrow('JSON-compatible');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects invalid UUID identities and JSON fields before persistence', async () => {
    const patch = jest.fn(async () => 1);
    const { dialect, repository, service } = testService({
      definition: uuidResource,
      dialect: { patch },
    });
    const uuid = '123e4567-e89b-12d3-a456-426614174000';

    await expect(
      service.createEntity({
        guid: 'not-a-uuid',
        title: 'Title',
        externalRefId: uuid,
      }),
    ).rejects.toThrow('canonical UUID');
    await expect(
      service.createEntity({
        guid: uuid,
        title: 'Title',
        externalRefId: 'not-a-uuid',
      }),
    ).rejects.toThrow('canonical UUID');
    await expect(service.getEntity({ guid: 'not-a-uuid' })).rejects.toThrow(
      'canonical UUID',
    );
    await expect(
      service.updateEntity(
        { guid: uuid },
        { expectedRevision: 1, externalRefId: 'not-a-uuid' },
      ),
    ).rejects.toThrow('canonical UUID');

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.findOne).not.toHaveBeenCalled();
    expect(dialect.patch).not.toHaveBeenCalled();
  });

  it('rejects a typed create field that also exists in raw payload', async () => {
    const { repository, service } = testService();

    await expect(
      service.createEntity({
        guid: 'record-1',
        title: 'Title',
        priority: 3,
        payload: { workflow: { priority: 2 } },
      }),
    ).rejects.toThrow('both in payload and as a projected input');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('projects JSON fields on reads and rejects scope conditions', async () => {
    const record: ProjectionRecord = {
      scopeId: 'space-1',
      guid: 'record-1',
      revision: 2,
      payload: { workflow: { title: 'Title', priority: 3 } },
    };
    const { repository, service } = testService({
      repository: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(record)
          .mockResolvedValue(null),
      },
    });

    await expect(
      service.getEntity({ guid: 'record-1' }),
    ).resolves.toMatchObject({
      title: 'Title',
      priority: 3,
      plannedEnd: null,
      metadata: null,
    });
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { scopeId: 'space-1', guid: 'record-1' },
    });
    await expect(
      service.getEntity({ guid: 'record-1', scopeId: 'other' }),
    ).rejects.toThrow('conditions require only a guid');
    await expect(
      service.getEntity({ guid: 'record-1', unexpected: true }),
    ).rejects.toThrow('conditions require only a guid');
    await expect(
      service.getEntity({ guid: 'missing' }, undefined, undefined, undefined, {
        failOnNull: true,
      }),
    ).rejects.toThrow('not found');
  });

  it('translates supported find filters, sort, and pagination to the dialect', async () => {
    const record: ProjectionRecord = {
      scopeId: 'space-1',
      guid: 'record-1',
      revision: 2,
      payload: {
        workflow: {
          title: 'Title',
          priority: 3,
          plannedEnd: '2031-02-03T04:05:06.000Z',
        },
      },
    };
    const findMany = jest.fn(
      async () => [[record], 1] as [ProjectionRecord[], number],
    );
    const { dialect, service } = testService({ dialect: { findMany } });

    const listed = await service.getEntityListExtended(
      {
        where: {
          filters: {
            guid: In(['record-1', 'record-2']),
            priority: Between(1, 5),
          },
          childExpressions: [
            {
              filters: {
                plannedEnd: Equal(new Date('2031-02-03T04:05:06.000Z')),
              },
            },
          ],
        },
        order: { priority: 'DESC', title: 'ASC' },
        skip: 2,
        take: 4,
      } as never,
      true,
    );

    expect(dialect.findMany).toHaveBeenCalledWith(
      expect.anything(),
      resource,
      'space-1',
      expect.arrayContaining([
        expect.objectContaining({
          operator: 'in',
          values: ['record-1', 'record-2'],
        }),
        expect.objectContaining({ operator: 'range', values: [1, 5] }),
        expect.objectContaining({
          operator: 'eq',
          values: ['2031-02-03T04:05:06.000Z'],
        }),
      ]),
      [
        expect.objectContaining({
          field: expect.objectContaining({ name: 'priority' }),
          direction: 'DESC',
        }),
        expect.objectContaining({
          field: expect.objectContaining({ name: 'title' }),
          direction: 'ASC',
        }),
      ],
      { skip: 2, take: 4 },
    );
    expect(listed).toEqual([
      [
        expect.objectContaining({
          title: 'Title',
          priority: 3,
          plannedEnd: '2031-02-03T04:05:06.000Z',
        }),
      ],
      1,
    ]);
  });

  it('fails closed for unsupported list filters and sorts', async () => {
    const { dialect, events, service } = testService();

    await expect(
      service.getEntityListExtended({
        where: { filters: { metadata: { type: 'equal', value: {} } } },
      } as never),
    ).rejects.toThrow('does not allow eq');
    await expect(
      service.getEntityListExtended({ order: { metadata: 'ASC' } } as never),
    ).rejects.toThrow('not sortable');
    await expect(
      service.getEntityListExtended({
        where: { filters: { priority: { type: 'between', value: [1] } } },
      } as never),
    ).rejects.toThrow('requires 2 filter values');
    await expect(
      service.getEntityListExtended({
        where: { filters: { priority: null } },
      } as never),
    ).rejects.toThrow('does not support null filters');
    await expect(
      service.getEntityListExtended({
        where: { operator: 'OR', filters: { title: Equal('Title') } },
      } as never),
    ).rejects.toThrow('AND-only');
    await expect(
      service.getEntityListExtended({
        where: {
          filters: { title: Equal('Title') },
          childExpressions: [
            { operator: 'OR', filters: { priority: Equal(3) } },
          ],
        },
      } as never),
    ).rejects.toThrow('AND-only');
    await expect(
      service.getEntityListExtended({
        where: { filters: { unknown: Equal('Title') } },
      } as never),
    ).rejects.toThrow('Projection filter field unknown is not declared');
    await expect(
      service.getEntityListExtended({ order: { unknown: 'ASC' } } as never),
    ).rejects.toThrow('Projection sort field unknown is not declared');
    await expect(
      service.getEntityListExtended({ order: { title: 'SIDEWAYS' } } as never),
    ).rejects.toThrow('invalid sort direction');
    await expect(
      service.getEntityListExtended({ skip: -1 } as never),
    ).rejects.toThrow('skip must be a non-negative safe integer');
    await expect(
      service.getEntityListExtended({ take: 0 } as never),
    ).rejects.toThrow('take must be a positive safe integer');
    expect(dialect.findMany).not.toHaveBeenCalled();
    expect(events.errorBadRequest).toHaveBeenCalledWith(
      'projection.invalid-request',
      expect.anything(),
    );
  });

  it('creates an optimistic projected-field patch and returns the re-read record', async () => {
    const updated: ProjectionRecord = {
      scopeId: 'space-1',
      guid: 'record-1',
      revision: 3,
      payload: {
        workflow: { title: 'Changed', priority: null },
        metadata: { flags: ['one'] },
      },
    };
    const patch = jest.fn(async () => 1);
    const findOneOrFail = jest.fn(async () => updated);
    const { dialect, repository, service } = testService({
      dialect: { patch },
      repository: { findOneOrFail },
    });

    await expect(
      service.updateEntity(
        { guid: 'record-1' },
        {
          expectedRevision: 2,
          title: 'Changed',
          priority: null,
          metadata: { flags: ['one'] },
        },
      ),
    ).resolves.toMatchObject({
      title: 'Changed',
      priority: null,
      metadata: { flags: ['one'] },
    });
    expect(dialect.patch).toHaveBeenCalledWith(
      repository,
      resource,
      expect.objectContaining({
        scopeId: 'space-1',
        guid: 'record-1',
        expectedRevision: 2,
        columnValues: {},
        jsonValues: expect.arrayContaining([
          expect.objectContaining({
            field: expect.objectContaining({ name: 'title' }),
            value: 'Changed',
          }),
          expect.objectContaining({
            field: expect.objectContaining({ name: 'priority' }),
            value: null,
          }),
          expect.objectContaining({
            field: expect.objectContaining({ name: 'metadata' }),
            value: { flags: ['one'] },
          }),
        ]),
      }),
    );
    expect(findOneOrFail).toHaveBeenCalledWith({
      where: { scopeId: 'space-1', guid: 'record-1' },
    });
  });

  it('rejects immutable identity update input before compiling a patch', async () => {
    const patch = jest.fn(async () => 1);
    const { service } = testService({ dialect: { patch } });

    await expect(
      service.updateEntity(
        { guid: 'record-1' },
        { expectedRevision: 1, guid: 'renamed-record' },
      ),
    ).rejects.toThrow('Projection identity guid is immutable');
    await expect(
      service.updateEntity(
        { guid: 'record-1' },
        {
          expectedRevision: 1,
          guid: 'renamed-record',
          title: 'Changed',
        },
      ),
    ).rejects.toThrow('Projection identity guid is immutable');
    expect(patch).not.toHaveBeenCalled();
  });

  it('rejects raw payload and empty patches, then distinguishes missing from stale', async () => {
    const missing = testService({ dialect: { patch: jest.fn(async () => 0) } });
    await expect(
      missing.service.updateEntity(
        { guid: 'record-1' },
        { expectedRevision: 1, payload: {} },
      ),
    ).rejects.toThrow('payload is not writable');
    await expect(
      missing.service.updateEntity(
        { guid: 'record-1' },
        { expectedRevision: 1 },
      ),
    ).rejects.toThrow('requires at least one writable field');
    await expect(
      missing.service.updateEntity(
        { guid: 'record-1' },
        { expectedRevision: 0, title: 'Changed' },
      ),
    ).rejects.toThrow('integer between 1 and');
    await expect(
      missing.service.updateEntity(
        { guid: 'record-1' },
        { expectedRevision: PROJECTION_INTEGER_MAX, title: 'Changed' },
      ),
    ).rejects.toThrow(`1 and ${PROJECTION_INTEGER_MAX - 1}`);
    await expect(
      missing.service.updateEntity(
        { guid: 'record-1' },
        { expectedRevision: '1', title: 'Changed' },
      ),
    ).rejects.toThrow('integer between 1 and');
    await expect(
      missing.service.updateEntity(
        { guid: 'record-1' },
        { expectedRevision: 1, title: 'Changed' },
      ),
    ).rejects.toThrow('not found');

    const stale = testService({
      dialect: { patch: jest.fn(async () => 0) },
      repository: { findOne: jest.fn(async () => ({ guid: 'record-1' })) },
    });
    await expect(
      stale.service.updateEntity(
        { guid: 'record-1' },
        { expectedRevision: 1, title: 'Changed' },
      ),
    ).rejects.toThrow('revision is stale');
  });

  it('hard-deletes only inside the trusted scope', async () => {
    const { repository, service } = testService({
      repository: { delete: jest.fn(async () => ({ affected: 1 })) },
    });

    await expect(service.deleteEntity({ guid: 'record-1' })).resolves.toBe(
      true,
    );
    expect(repository.delete).toHaveBeenCalledWith({
      scopeId: 'space-1',
      guid: 'record-1',
    });
    const missing = testService({
      repository: { delete: jest.fn(async () => ({ affected: 0 })) },
    });
    await expect(
      missing.service.deleteEntity({ guid: 'missing' }),
    ).rejects.toThrow('not found');
  });

  it('advertises the CrudGen capabilities it implements', () => {
    const { service } = testService();

    expect(service.supportsStructuredGraphqlFilters()).toBe(true);
    expect(service.supportsExtendedRepository()).toBe(true);
  });
});
