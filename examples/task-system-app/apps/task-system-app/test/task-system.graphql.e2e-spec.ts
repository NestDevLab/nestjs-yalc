import { INestApplication } from '@nestjs/common';
import { expect } from '@jest/globals';
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
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

  it('resolves nested project/task/event relations in GraphQL', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query RelationCoverage($projectGuid: String!, $taskGuid: String!, $eventGuid: String!) {
            TaskSystem_getTaskProject(ID: $projectGuid) {
              guid
              name
              tasks { guid title projectId }
              events { guid title projectId }
            }
            TaskSystem_getTaskItem(ID: $taskGuid) {
              guid
              title
              project { guid name }
            }
            TaskSystem_getTaskEvent(ID: $eventGuid) {
              guid
              title
              project { guid name }
            }
          }
        `,
        variables: {
          projectGuid,
          taskGuid,
          eventGuid,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.TaskSystem_getTaskProject.guid).toBe(projectGuid);
    expect(res.body.data.TaskSystem_getTaskProject.tasks.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.TaskSystem_getTaskProject.events.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.TaskSystem_getTaskProject.tasks[0].projectId).toBe(projectGuid);
    expect(res.body.data.TaskSystem_getTaskProject.events[0].projectId).toBe(projectGuid);
    expect(res.body.data.TaskSystem_getTaskItem.project.guid).toBe(projectGuid);
    expect(res.body.data.TaskSystem_getTaskEvent.project.guid).toBe(projectGuid);
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
