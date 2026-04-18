import { INestApplication } from '@nestjs/common';
import { expect } from '@jest/globals';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Task System App GraphQL e2e', () => {
  let app: INestApplication;
  let projectGuid: string;
  let taskGuid: string;
  let eventGuid: string;
  let externalRefGuid: string;
  let syncStateGuid: string;
  let secondaryTaskGuid: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(new FastifyAdapter());
    await app.listen(0);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('creates a project via GraphQL', async () => {
    projectGuid = randomUUID();
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation CreateProject($input: TaskProjectCreateInput!) {
            TaskSystem_createTaskProject(input: $input) {
              guid
              name
              status
            }
          }
        `,
        variables: {
          input: {
            guid: projectGuid,
            name: 'GraphQL Project',
            description: 'Created via GraphQL',
            status: 'active',
          },
        },
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.TaskSystem_createTaskProject.guid).toBe(projectGuid);
  });

  it('creates a task via GraphQL', async () => {
    taskGuid = randomUUID();
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation CreateTask($input: TaskItemCreateInput!) {
            TaskSystem_createTaskItem(input: $input) {
              guid
              title
              projectId
            }
          }
        `,
        variables: {
          input: {
            guid: taskGuid,
            title: 'GraphQL Task',
            description: 'Created via GraphQL',
            status: 'todo',
            projectId: projectGuid,
          },
        },
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.TaskSystem_createTaskItem.guid).toBe(taskGuid);
  });

  it('creates an event via GraphQL', async () => {
    eventGuid = randomUUID();
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation CreateEvent($input: TaskEventCreateInput!) {
            TaskSystem_createTaskEvent(input: $input) {
              guid
              title
              projectId
            }
          }
        `,
        variables: {
          input: {
            guid: eventGuid,
            title: 'GraphQL Event',
            description: 'Created via GraphQL',
            status: 'scheduled',
            startAt: '2026-04-03T12:00:00.000Z',
            endAt: '2026-04-03T13:00:00.000Z',
            allDay: false,
            projectId: projectGuid,
            location: 'Meet',
          },
        },
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.TaskSystem_createTaskEvent.guid).toBe(eventGuid);
  });

  it('creates a second task for sorting/pagination coverage', async () => {
    secondaryTaskGuid = randomUUID();
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation CreateTask($input: TaskItemCreateInput!) {
            TaskSystem_createTaskItem(input: $input) {
              guid
              title
              projectId
            }
          }
        `,
        variables: {
          input: {
            guid: secondaryTaskGuid,
            title: 'Aaa First Task',
            description: 'Created for sorting coverage',
            status: 'done',
            projectId: projectGuid,
          },
        },
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.TaskSystem_createTaskItem.guid).toBe(secondaryTaskGuid);
  });

  it('creates an external ref via GraphQL', async () => {
    externalRefGuid = randomUUID();
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation CreateExternalRef($input: TaskExternalRefCreateInput!) {
            TaskSystem_createTaskExternalRef(input: $input) {
              guid
              provider
              externalId
            }
          }
        `,
        variables: {
          input: {
            guid: externalRefGuid,
            internalType: 'task',
            internalId: taskGuid,
            provider: 'google-tasks',
            account: 'default',
            container: 'primary',
            externalId: 'gql-ext-1',
          },
        },
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.TaskSystem_createTaskExternalRef.guid).toBe(
      externalRefGuid,
    );
  });

  it('creates a sync state via GraphQL', async () => {
    syncStateGuid = randomUUID();
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation CreateSyncState($input: TaskSyncStateCreateInput!) {
            TaskSystem_createTaskSyncState(input: $input) {
              guid
              externalRefId
              status
            }
          }
        `,
        variables: {
          input: {
            guid: syncStateGuid,
            externalRefId: externalRefGuid,
            status: 'active',
            lastDirection: 'push',
            remoteVersion: 'v1',
            localVersionHash: 'hash-1',
          },
        },
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.TaskSystem_createTaskSyncState.guid).toBe(syncStateGuid);
  });

  it('returns GraphQL grids for all slices', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query {
            TaskSystem_getTaskProjectGrid { pageData { count } nodes { guid name } }
            TaskSystem_getTaskItemGrid { pageData { count } nodes { guid title } }
            TaskSystem_getTaskEventGrid { pageData { count } nodes { guid title } }
            TaskSystem_getTaskExternalRefGrid { pageData { count } nodes { guid provider } }
            TaskSystem_getTaskSyncStateGrid { pageData { count } nodes { guid status } }
          }
        `,
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.TaskSystem_getTaskProjectGrid.pageData.count).toBeGreaterThanOrEqual(1);
    expect(res.body.data.TaskSystem_getTaskItemGrid.pageData.count).toBeGreaterThanOrEqual(1);
    expect(res.body.data.TaskSystem_getTaskEventGrid.pageData.count).toBeGreaterThanOrEqual(1);
    expect(res.body.data.TaskSystem_getTaskExternalRefGrid.pageData.count).toBeGreaterThanOrEqual(1);
    expect(res.body.data.TaskSystem_getTaskSyncStateGrid.pageData.count).toBeGreaterThanOrEqual(1);
  });

  it('preserves GraphQL relation linkage fields', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query RelationCoverage($taskGuid: String!, $eventGuid: String!) {
            TaskSystem_getTaskItem(ID: $taskGuid) {
              guid
              title
              projectId
            }
            TaskSystem_getTaskEvent(ID: $eventGuid) {
              guid
              title
              projectId
            }
          }
        `,
        variables: {
          taskGuid,
          eventGuid,
        },
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.TaskSystem_getTaskItem.projectId).toBe(projectGuid);
    expect(res.body.data.TaskSystem_getTaskEvent.projectId).toBe(projectGuid);
  });

  it('exposes GraphQL join args on task grids', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query TaskItemGridJoinArgs {
            __type(name: "Query") {
              fields {
                name
                args { name }
              }
            }
          }
        `,
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    const gridField = res.body.data.__type.fields.find(
      (field: any) => field.name === 'TaskSystem_getTaskItemGrid',
    );
    const argNames = gridField.args.map((arg: any) => arg.name);
    expect(argNames).toContain('join');
    expect(argNames).toContain('sorting');
    expect(argNames).toContain('startRow');
    expect(argNames).toContain('endRow');
  });

  it('supports GraphQL sorting on task grids', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query SortedTasks {
            TaskSystem_getTaskItemGrid(
              sorting: [{ colId: title, sort: ASC }]
            ) {
              pageData { count }
              nodes { guid title status projectId }
            }
          }
        `,
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.TaskSystem_getTaskItemGrid.pageData.count).toBeGreaterThanOrEqual(2);
    expect(res.body.data.TaskSystem_getTaskItemGrid.nodes[0].guid).toBe(secondaryTaskGuid);
    expect(res.body.data.TaskSystem_getTaskItemGrid.nodes[0].title).toBe('Aaa First Task');
  });

  it('accepts GraphQL join args on task grids', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query JoinedTaskGrid {
            TaskSystem_getTaskItemGrid(
              join: { project: { joinType: LEFT_JOIN } }
              sorting: [{ colId: title, sort: ASC }]
            ) {
              pageData { count }
              nodes { guid title projectId }
            }
          }
        `,
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.TaskSystem_getTaskItemGrid.pageData.count).toBeGreaterThanOrEqual(2);
    expect(res.body.data.TaskSystem_getTaskItemGrid.nodes.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects structured GraphQL filters on plain fallback grids', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query FilteredTasks($filters: TaskItemTypeFilterExpressionInput) {
            TaskSystem_getTaskItemGrid(filters: $filters) {
              pageData { count }
              nodes { guid title }
            }
          }
        `,
        variables: {
          filters: {
            operator: "AND",
            expressions: [
              {
                TEXT: {
                  field: "title",
                  filterType: "text",
                  type: "contains",
                  filter: "Aaa"
                }
              }
            ]
          },
        },
      })
      .expect(400);

    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toEqual(expect.any(String));
  });

  it('rejects invalid GraphQL join enum values', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query InvalidJoinEnum {
            TaskSystem_getTaskItemGrid(
              join: { project: { joinType: LEFT } }
            ) {
              pageData { count }
              nodes { guid }
            }
          }
        `,
      })
      .expect(400);

    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toContain(
      'Value "LEFT" does not exist in',
    );
    expect(res.body.errors[0].message).toContain('enum');
  });

  it('supports GraphQL pagination on task grids', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query PaginatedTasks {
            TaskSystem_getTaskItemGrid(
              startRow: 0
              endRow: 1
              sorting: [{ colId: title, sort: ASC }]
            ) {
              pageData { count startRow endRow }
              nodes { guid title status projectId }
            }
          }
        `,
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.TaskSystem_getTaskItemGrid.pageData.count).toBeGreaterThanOrEqual(2);
    expect(res.body.data.TaskSystem_getTaskItemGrid.pageData.startRow).toBe(0);
    expect(res.body.data.TaskSystem_getTaskItemGrid.pageData.endRow).toBe(1);
    expect(res.body.data.TaskSystem_getTaskItemGrid.nodes).toHaveLength(1);
    expect(res.body.data.TaskSystem_getTaskItemGrid.nodes[0].guid).toBe(secondaryTaskGuid);
    expect(res.body.data.TaskSystem_getTaskItemGrid.nodes[0].title).toBe('Aaa First Task');
  });

  it('updates and deletes sync state via GraphQL', async () => {
    const updateRes = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation UpdateSyncState($guid: UUID!, $input: TaskSyncStateUpdateInput!) {
            TaskSystem_updateTaskSyncState(conditions: { guid: $guid }, input: $input) {
              status
              lastError
            }
          }
        `,
        variables: {
          guid: syncStateGuid,
          input: { status: 'error', lastError: 'GraphQL failure test' },
        },
      })
      .expect(200);

    expect(updateRes.body.errors).toBeUndefined();
    expect(updateRes.body.data.TaskSystem_updateTaskSyncState.status).toBe('error');

    const deleteRes = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation DeleteSyncState($guid: UUID!) {
            TaskSystem_deleteTaskSyncState(conditions: { guid: $guid })
          }
        `,
        variables: { guid: syncStateGuid },
      })
      .expect(200);

    expect(deleteRes.body.errors).toBeUndefined();
    expect(deleteRes.body.data.TaskSystem_deleteTaskSyncState).toBe(true);
  });
});
