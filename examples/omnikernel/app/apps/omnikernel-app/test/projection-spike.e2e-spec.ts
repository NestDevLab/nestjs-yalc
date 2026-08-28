import type { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  createProjectionGraphqlTypes,
  createProjectionSchemaOptions,
  defineProjectionResource,
  getModelFieldMetadataList,
  PROJECTION_INTEGER_MAX,
  PROJECTION_INTEGER_MIN,
  type ProjectionDialect,
} from '@nestjs-yalc/crud-gen';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { projectionRecordDefinition } from '../src/projection-spike/projection-spike.definition';
import { ProjectionRelation } from '../src/projection-spike/projection-spike.entities';
import { PROJECTION_SPIKE_DIALECT } from '../src/projection-spike/projection-spike.module';
import { ProjectionScopeContext } from '../src/projection-spike/projection-spike.services';
import {
  createProjectionSpikeTestApp,
  type ProjectionSpikeDialect,
} from '../src/projection-spike/projection-spike-test-app';

const dialect = (process.env.PROJECTION_SPIKE_DIALECT ??
  'sqlite') as ProjectionSpikeDialect;

const scopeA = 'scope-alpha';
const scopeB = 'scope-bravo';

jest.setTimeout(30_000);

const authenticated = (scopeId: string) => ({
  Authorization: `Bearer projection-spike:${scopeId}`,
});

const gql = (
  app: INestApplication,
  scopeId: string,
  query: string,
  variables?: Record<string, unknown>,
) =>
  request(app.getHttpServer())
    .post('/graphql')
    .set(authenticated(scopeId))
    .send({ query, variables });

describe(`projection spike semantic suite (${dialect})`, () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createProjectionSpikeTestApp({
      dialect,
      postgresUrl: process.env.PROJECTION_SPIKE_POSTGRES_URL,
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('keeps one immutable contract across public shape and physical promotion', () => {
    const promotedDefinition = defineProjectionResource({
      ...projectionRecordDefinition,
      fields: projectionRecordDefinition.fields.map((field) => {
        if (field.name !== 'status') return field;
        const { path: _path, ...withoutPath } = field;
        return {
          ...withoutPath,
          storage: 'column' as const,
          column: 'status',
        };
      }),
    });
    const jsonTypes = createProjectionGraphqlTypes(projectionRecordDefinition, {
      object: 'ProjectionJsonShape',
      create: 'ProjectionJsonShapeCreate',
      patch: 'ProjectionJsonShapePatch',
      conditions: 'ProjectionJsonShapeCondition',
    });
    const promotedTypes = createProjectionGraphqlTypes(promotedDefinition, {
      object: 'ProjectionPromotedShape',
      create: 'ProjectionPromotedShapeCreate',
      patch: 'ProjectionPromotedShapePatch',
      conditions: 'ProjectionPromotedShapeCondition',
    });
    const schema = createProjectionSchemaOptions(
      promotedDefinition,
      app.get<ProjectionDialect>(PROJECTION_SPIKE_DIALECT),
    );

    expect(Object.isFrozen(projectionRecordDefinition)).toBe(true);
    expect(Object.isFrozen(projectionRecordDefinition.fields)).toBe(true);
    expect(projectionRecordDefinition.identity.uniqueWithinScope).toBe(true);
    expect(Object.keys(getModelFieldMetadataList(jsonTypes.object)!)).toEqual(
      Object.keys(getModelFieldMetadataList(promotedTypes.object)!),
    );
    expect(schema.columns.status).toMatchObject({
      type: String,
      nullable: false,
    });
  });

  it('keeps scope server-owned while allowing scoped uniqueness', async () => {
    await request(app.getHttpServer())
      .post('/projection-records')
      .set(authenticated(scopeA))
      .send({
        guid: 'shared-guid',
        title: 'must not select a client scope',
        status: 'open',
        scopeId: scopeB,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/projection-records')
      .set(authenticated(scopeA))
      .send({
        guid: 'raw-array',
        title: 'raw array',
        status: 'open',
        payload: [],
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/projection-records')
      .set(authenticated(scopeA))
      .send({
        guid: 'raw-projected-collision',
        title: 'raw collision',
        status: 'typed value',
        payload: { workflow: { status: 'raw value' } },
      })
      .expect(400);

    const created = await gql(
      app,
      scopeA,
      `mutation CreateProjectionRecord($input: ProjectionRecordCreateInput!) {
        createProjectionRecord(input: $input) {
          guid
          title
          status
          plannedEnd
          revision
          payload
        }
      }`,
      {
        input: {
          guid: 'shared-guid',
          title: 'Scope A record',
          status: 'open',
          plannedEnd: '2030-01-02T03:04:05.000Z',
          payload: {
            sibling: { keep: 'yes' },
            workflow: { untouched: 'sibling' },
          },
        },
      },
    ).expect(200);

    expect(created.body.errors).toBeUndefined();
    expect(created.body.data.createProjectionRecord).toMatchObject({
      guid: 'shared-guid',
      status: 'open',
      revision: 1,
      payload: {
        sibling: { keep: 'yes' },
        workflow: {
          status: 'open',
          untouched: 'sibling',
          plan: { end: '2030-01-02T03:04:05.000Z' },
        },
      },
    });
    expect(created.body.data.createProjectionRecord.scopeId).toBeUndefined();

    await request(app.getHttpServer())
      .post('/projection-records')
      .set(authenticated(scopeA))
      .send({
        guid: 'shared-guid',
        title: 'Duplicate in scope A',
        status: 'open',
      })
      .expect(409);

    await request(app.getHttpServer())
      .post('/projection-records')
      .set(authenticated(scopeA))
      .send({
        guid: 'scope-a-only',
        title: 'Scope A only record',
        status: 'open',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/projection-records')
      .set(authenticated(scopeB))
      .send({
        guid: 'shared-guid',
        title: 'Scope B record',
        status: 'open',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/projection-records')
      .set(authenticated(scopeB))
      .send({
        guid: 'scope-b-only',
        title: 'Scope B only record',
        status: 'open',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/projection-records/shared-guid')
      .set(authenticated(scopeB))
      .expect(200)
      .expect(({ body }) => {
        expect(body.title).toBe('Scope B record');
        expect(body.scopeId).toBeUndefined();
      });

    await request(app.getHttpServer())
      .get('/projection-records/missing-guid')
      .set(authenticated(scopeA))
      .expect(404);

    const graphReadA = await gql(
      app,
      scopeA,
      'query { getProjectionRecord(guid: "shared-guid") { guid title } }',
    ).expect(200);
    const graphReadB = await gql(
      app,
      scopeB,
      'query { getProjectionRecord(guid: "shared-guid") { guid title } }',
    ).expect(200);
    const graphOutside = await gql(
      app,
      scopeB,
      'query { getProjectionRecord(guid: "scope-a-only") { guid title } }',
    ).expect(200);

    expect(graphReadA.body.data.getProjectionRecord.title).toBe(
      'Scope A record',
    );
    expect(graphReadB.body.data.getProjectionRecord.title).toBe(
      'Scope B record',
    );
    expect(graphOutside.body.data).toBeNull();
    expect(graphOutside.body.errors?.[0]?.message).toContain(
      'Cannot return null',
    );
    expect(
      new ProjectionScopeContext({ projectionScopeId: scopeA }).cacheKey(
        'shared-guid',
      ),
    ).not.toBe(
      new ProjectionScopeContext({ projectionScopeId: scopeB }).cacheKey(
        'shared-guid',
      ),
    );
  });

  it('uses one generated REST and GraphQL service contract for JSON query semantics', async () => {
    for (const guid of ['record-b', 'record-a']) {
      await request(app.getHttpServer())
        .post('/projection-records')
        .set(authenticated(scopeA))
        .send({ guid, title: guid, status: 'open' })
        .expect(201);
    }

    const restGrid = await request(app.getHttpServer())
      .get('/projection-records')
      .set(authenticated(scopeA))
      .query({
        startRow: 0,
        endRow: 2,
        sorting: JSON.stringify([{ colId: 'status', sort: 'ASC' }]),
        filters: JSON.stringify({
          expressions: [
            {
              text: {
                field: 'status',
                type: 'equals',
                filter: 'open',
                filterType: 'text',
              },
            },
          ],
        }),
      })
      .expect(200);

    expect(
      restGrid.body.list.map((record: { guid: string }) => record.guid),
    ).toEqual(['record-a', 'record-b']);

    const graphGrid = await gql(
      app,
      scopeA,
      `query {
        getProjectionRecordGrid(
          sorting: [{ colId: status, sort: ASC }]
          filters: { expressions: [{ text: { field: status, type: EQUALS, filter: "open", filterType: TEXT } }] }
          startRow: 0
          endRow: 2
        ) {
          nodes { guid status revision }
          pageData { count startRow endRow }
        }
      }`,
    ).expect(200);

    expect(graphGrid.body.errors).toBeUndefined();
    expect(
      graphGrid.body.data.getProjectionRecordGrid.nodes.map(
        (record: { guid: string }) => record.guid,
      ),
    ).toEqual(['record-a', 'record-b']);
    expect(graphGrid.body.data.getProjectionRecordGrid.pageData).toMatchObject({
      count: 4,
      startRow: 0,
      endRow: 2,
    });

    for (let index = 0; index < 1_000; index += 1) {
      await request(app.getHttpServer())
        .post('/projection-records')
        .set(authenticated(scopeA))
        .send({
          guid: `bulk-${String(index).padStart(3, '0')}`,
          title: `bulk ${index}`,
          status: 'bulk',
        })
        .expect(201);
    }
    await request(app.getHttpServer())
      .post('/projection-records')
      .set(authenticated(scopeA))
      .send({ guid: 'indexed-needle', title: 'needle', status: 'needle' })
      .expect(201);

    const projectionDialect = app.get<ProjectionDialect>(
      PROJECTION_SPIKE_DIALECT,
    );
    const dataSource = app.get<DataSource>(getDataSourceToken());
    const storage = await projectionDialect.inspect(
      dataSource,
      projectionRecordDefinition,
    );
    const plan = await projectionDialect.explainIndexedEquality(
      dataSource,
      projectionRecordDefinition,
      projectionRecordDefinition.fields.find(
        (field) => field.name === 'status',
      )!,
      scopeA,
      'needle',
    );

    expect(storage.payloadStorage).toBe(
      dialect === 'postgres' ? 'jsonb' : 'sqlite-json1',
    );
    expect(storage.validJson).toBe(true);
    expect(storage.indexes).toEqual(
      expect.arrayContaining([
        'projection_spike_record_status_idx',
        'projection_spike_record_planned_end_idx',
        'projection_spike_record_priority_idx',
      ]),
    );
    expect(plan.usesDeclaredIndex).toBe(true);
    expect(plan.lines).not.toHaveLength(0);
    expect(
      dataSource
        .getMetadata(ProjectionRelation)
        .indices.map((index) => index.givenName),
    ).toEqual(
      expect.arrayContaining([
        'projection_spike_relation_source_idx',
        'projection_spike_relation_target_idx',
      ]),
    );
  });

  it('keeps integer and instant query semantics portable across dialects', async () => {
    for (const [guid, priority] of [
      ['minimum-priority', PROJECTION_INTEGER_MIN],
      ['maximum-priority', PROJECTION_INTEGER_MAX],
    ] as const) {
      await request(app.getHttpServer())
        .post('/projection-records')
        .set(authenticated(scopeA))
        .send({ guid, title: guid, status: 'typed-query', priority })
        .expect(201);
    }

    for (const priority of [
      PROJECTION_INTEGER_MIN - 1,
      PROJECTION_INTEGER_MAX + 1,
    ]) {
      await request(app.getHttpServer())
        .post('/projection-records')
        .set(authenticated(scopeA))
        .send({
          guid: `out-of-range-${priority}`,
          title: 'out of range',
          status: 'typed-query',
          priority,
        })
        .expect(400);
    }

    await request(app.getHttpServer())
      .post('/projection-records')
      .set(authenticated(scopeA))
      .send({
        guid: 'invalid-priority',
        title: 'invalid priority',
        status: 'typed-query',
        priority: '10',
      })
      .expect(400);

    const graphOutOfRange = await gql(
      app,
      scopeA,
      `mutation CreateProjectionRecord($input: ProjectionRecordCreateInput!) {
        createProjectionRecord(input: $input) { guid }
      }`,
      {
        input: {
          guid: 'graph-out-of-range',
          title: 'graph out of range',
          status: 'typed-query',
          priority: PROJECTION_INTEGER_MAX + 1,
        },
      },
    ).expect(400);
    expect(graphOutOfRange.body.errors?.[0]?.message).toContain(
      '32-bit signed integer',
    );

    await request(app.getHttpServer())
      .post('/projection-records')
      .set(authenticated(scopeA))
      .send({
        guid: 'invalid-instant',
        title: 'invalid instant',
        status: 'typed-query',
        plannedEnd: '2030-01-02',
      })
      .expect(400);

    for (const record of [
      {
        guid: 'typed-10',
        priority: 10,
        plannedEnd: '2040-01-10T00:00:00.000Z',
      },
      {
        guid: 'typed-2',
        priority: 2,
        plannedEnd: '2040-01-02T00:00:00.000Z',
      },
      {
        guid: 'typed-20',
        priority: 20,
        plannedEnd: '2040-01-20T00:00:00.000Z',
      },
    ]) {
      await request(app.getHttpServer())
        .post('/projection-records')
        .set(authenticated(scopeA))
        .send({
          ...record,
          title: record.guid,
          status: 'typed-query',
        })
        .expect(201);
    }

    const integerGrid = await request(app.getHttpServer())
      .get('/projection-records')
      .set(authenticated(scopeA))
      .query({
        sorting: JSON.stringify([{ colId: 'priority', sort: 'ASC' }]),
        filters: JSON.stringify({
          expressions: [
            {
              number: {
                field: 'priority',
                type: 'inRange',
                filter: 2,
                filterTo: 10,
                filterType: 'number',
              },
            },
          ],
        }),
      })
      .expect(200);

    expect(
      integerGrid.body.list.map((record: { guid: string }) => record.guid),
    ).toEqual(['typed-2', 'typed-10']);

    const instantGrid = await gql(
      app,
      scopeA,
      `query {
        getProjectionRecordGrid(
          sorting: [{ colId: plannedEnd, sort: DESC }]
          filters: { expressions: [{ date: {
            field: plannedEnd
            type: INRANGE
            dateFrom: "2040-01-02T00:00:00.000Z"
            dateTo: "2040-01-10T00:00:00.000Z"
            filterType: DATE
          } }] }
        ) {
          nodes { guid priority plannedEnd }
        }
      }`,
    ).expect(200);

    expect(instantGrid.body.errors).toBeUndefined();
    expect(
      instantGrid.body.data.getProjectionRecordGrid.nodes.map(
        (record: { guid: string }) => record.guid,
      ),
    ).toEqual(['typed-10', 'typed-2']);
  });

  it('creates absent JSON object ancestors for deep patches without losing siblings', async () => {
    await request(app.getHttpServer())
      .post('/projection-records')
      .set(authenticated(scopeA))
      .send({
        guid: 'missing-deep-ancestors',
        title: 'missing deep ancestors',
        status: 'open',
        payload: {
          sibling: { keep: 'top-level' },
          workflow: { untouched: 'keep' },
        },
      })
      .expect(201);

    const patched = await request(app.getHttpServer())
      .put('/projection-records/missing-deep-ancestors')
      .set(authenticated(scopeA))
      .send({
        expectedRevision: 1,
        plannedEnd: '2042-03-04T05:06:07.000Z',
      })
      .expect(200);

    expect(patched.body).toMatchObject({
      revision: 2,
      plannedEnd: '2042-03-04T05:06:07.000Z',
      payload: {
        sibling: { keep: 'top-level' },
        workflow: {
          status: 'open',
          untouched: 'keep',
          plan: { end: '2042-03-04T05:06:07.000Z' },
        },
      },
    });
  });

  it('applies atomic patches with null-versus-absent semantics and a standard conflict', async () => {
    const patched = await request(app.getHttpServer())
      .put('/projection-records/shared-guid')
      .set(authenticated(scopeA))
      .send({ expectedRevision: 1, plannedEnd: null })
      .expect(200);

    expect(patched.body).toMatchObject({
      revision: 2,
      plannedEnd: null,
      payload: {
        sibling: { keep: 'yes' },
        workflow: {
          status: 'open',
          untouched: 'sibling',
          plan: { end: null },
        },
      },
    });

    const graphPatched = await gql(
      app,
      scopeA,
      `mutation PatchProjectionRecord($conditions: ProjectionRecordCondition!, $input: ProjectionRecordPatchInput!) {
        updateProjectionRecord(conditions: $conditions, input: $input) {
          guid
          title
          status
          plannedEnd
          revision
          payload
        }
      }`,
      {
        conditions: { guid: 'shared-guid' },
        input: { expectedRevision: 2, title: 'Scope A updated' },
      },
    ).expect(200);

    expect(graphPatched.body.errors).toBeUndefined();
    expect(graphPatched.body.data.updateProjectionRecord).toMatchObject({
      title: 'Scope A updated',
      revision: 3,
      plannedEnd: null,
      payload: {
        sibling: { keep: 'yes' },
        workflow: {
          status: 'open',
          untouched: 'sibling',
          plan: { end: null },
        },
      },
    });

    await request(app.getHttpServer())
      .put('/projection-records/shared-guid')
      .set(authenticated(scopeA))
      .send({ expectedRevision: 1, status: 'closed' })
      .expect(409);

    await request(app.getHttpServer())
      .put('/projection-records/shared-guid')
      .set(authenticated(scopeA))
      .send({ expectedRevision: 3 })
      .expect(400);

    const identityPatchMutation = `mutation PatchProjectionRecord($conditions: ProjectionRecordCondition!, $input: ProjectionRecordPatchInput!) {
      updateProjectionRecord(conditions: $conditions, input: $input) { revision }
    }`;
    for (const input of [
      { expectedRevision: 3, guid: 'renamed-guid' },
      { expectedRevision: 3, guid: 'renamed-guid', title: 'must reject' },
    ]) {
      const graphIdentityPatch = await gql(app, scopeA, identityPatchMutation, {
        conditions: { guid: 'shared-guid' },
        input,
      }).expect(400);
      expect(graphIdentityPatch.body.errors?.[0]?.message).toContain(
        'Field "guid" is not defined',
      );
    }

    for (const input of [
      { expectedRevision: 3, guid: 'renamed-guid' },
      { expectedRevision: 3, guid: 'renamed-guid', title: 'must reject' },
    ]) {
      await request(app.getHttpServer())
        .put('/projection-records/shared-guid')
        .set(authenticated(scopeA))
        .send(input)
        .expect(400)
        .expect(({ body }) => {
          expect(body.message).toContain(
            'Projection identity guid is immutable',
          );
        });
    }

    const graphRawPayloadPatch = await gql(
      app,
      scopeA,
      `mutation PatchProjectionRecord($conditions: ProjectionRecordCondition!, $input: ProjectionRecordPatchInput!) {
        updateProjectionRecord(conditions: $conditions, input: $input) { revision }
      }`,
      {
        conditions: { guid: 'shared-guid' },
        input: {
          expectedRevision: 3,
          payload: { workflow: { status: 'attempted raw patch' } },
        },
      },
    ).expect(400);
    expect(graphRawPayloadPatch.body.errors?.[0]?.message).toContain(
      'Field "payload" is not defined',
    );

    await request(app.getHttpServer())
      .put('/projection-records/shared-guid')
      .set(authenticated(scopeA))
      .send({
        expectedRevision: 3,
        payload: { workflow: { status: 'attempted raw patch' } },
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/projection-records')
      .set(authenticated(scopeA))
      .send({ guid: 'race-guid', title: 'race', status: 'open' })
      .expect(201);
    const race = await Promise.all([
      request(app.getHttpServer())
        .put('/projection-records/race-guid')
        .set(authenticated(scopeA))
        .send({ expectedRevision: 1, title: 'first contender' }),
      request(app.getHttpServer())
        .put('/projection-records/race-guid')
        .set(authenticated(scopeA))
        .send({ expectedRevision: 1, title: 'second contender' }),
    ]);
    expect(race.map((response) => response.status).sort()).toEqual([200, 409]);
  });

  it('mechanically isolates generated relation endpoints and uses hard delete by declaration', async () => {
    await request(app.getHttpServer())
      .put('/projection-records/record-a')
      .set(authenticated(scopeB))
      .send({ expectedRevision: 1, title: 'must not cross scope' })
      .expect(404);
    await request(app.getHttpServer())
      .delete('/projection-records/record-a')
      .set(authenticated(scopeB))
      .expect(404);

    const created = await gql(
      app,
      scopeA,
      `mutation CreateProjectionRelation($input: ProjectionRelationCreateInput!) {
        createProjectionRelation(input: $input) { guid sourceGuid targetGuid kind }
      }`,
      {
        input: {
          guid: 'relation-a-b',
          sourceGuid: 'record-a',
          targetGuid: 'record-b',
          kind: 'depends-on',
        },
      },
    ).expect(200);

    expect(created.body.errors).toBeUndefined();
    expect(created.body.data.createProjectionRelation).toMatchObject({
      guid: 'relation-a-b',
      sourceGuid: 'record-a',
      targetGuid: 'record-b',
    });

    await request(app.getHttpServer())
      .post('/projection-relations')
      .set(authenticated(scopeA))
      .send({
        guid: 'cross-scope-relation',
        sourceGuid: 'record-a',
        targetGuid: 'scope-b-only',
        kind: 'depends-on',
      })
      .expect(404);

    const outsideRelationGrid = await gql(
      app,
      scopeB,
      `query { getProjectionRelationGrid { nodes { guid sourceGuid targetGuid } } }`,
    ).expect(200);

    expect(outsideRelationGrid.body.errors).toBeUndefined();
    expect(
      outsideRelationGrid.body.data.getProjectionRelationGrid.nodes,
    ).toEqual([]);

    await request(app.getHttpServer())
      .delete('/projection-records/shared-guid')
      .set(authenticated(scopeB))
      .expect(200);

    await request(app.getHttpServer())
      .get('/projection-records/shared-guid')
      .set(authenticated(scopeB))
      .expect(404);

    await request(app.getHttpServer())
      .get('/projection-records/shared-guid')
      .set(authenticated(scopeA))
      .expect(200);

    const deleted = await gql(
      app,
      scopeA,
      `mutation DeleteProjectionRecord($conditions: ProjectionRecordCondition!) {
        deleteProjectionRecord(conditions: $conditions)
      }`,
      { conditions: { guid: 'shared-guid' } },
    ).expect(200);

    expect(deleted.body.errors).toBeUndefined();
    expect(deleted.body.data.deleteProjectionRecord).toBe(true);

    await request(app.getHttpServer())
      .get('/projection-records/shared-guid')
      .set(authenticated(scopeA))
      .expect(404);
  });
});
