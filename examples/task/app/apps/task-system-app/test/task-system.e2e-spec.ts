import { INestApplication } from '@nestjs/common';
import { expect, jest } from '@jest/globals';
import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Task System App e2e', () => {
  let app: INestApplication;
  let createdProjectGuid: string;
  let createdTaskGuid: string;
  let createdEventGuid: string;
  let createdExternalRefGuid: string;
  let createdSyncStateGuid: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const httpService = app.get(HttpService);
    jest.spyOn(httpService.axiosRef, 'request').mockImplementation(async (config: any) => {
      const res = await request(app.getHttpServer())
        .get(config.url as string)
        .set(config.headers ?? {});

      return {
        data: res.body,
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
        request: {},
      };
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('creates a project', async () => {
    const guid = randomUUID();
    const res = await request(app.getHttpServer())
      .post('/projects')
      .send({
        guid,
        name: 'Open backlog redesign',
        description: 'Reference project for the task system app',
        status: 'active',
      })
      .expect(201);

    createdProjectGuid = res.body.guid;
    expect(createdProjectGuid).toBe(guid);
    expect(res.body.name).toBe('Open backlog redesign');
  });

  it('creates a task linked to the project', async () => {
    const guid = randomUUID();
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .send({
        guid,
        title: 'Define task system boundaries',
        description: 'Keep the backend standalone and provider-agnostic',
        status: 'todo',
        projectId: createdProjectGuid,
      })
      .expect(201);

    createdTaskGuid = res.body.guid;
    expect(createdTaskGuid).toBe(guid);
    expect(res.body.projectId).toBe(createdProjectGuid);
  });

  it('lists tasks with pagination metadata', async () => {
    const res = await request(app.getHttpServer()).get('/tasks').expect(200);
    expect(res.body.list.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pageData).toMatchObject({
      startRow: 0,
      count: expect.any(Number),
    });
  });

  it('lists Omni-backed tasks with structured REST sorting and filters', async () => {
    const res = await request(app.getHttpServer())
      .get('/tasks')
      .query({
        sorting: JSON.stringify([{ colId: 'title', sort: 'ASC' }]),
        filters: JSON.stringify({
          expressions: [
            {
              text: {
                field: 'title',
                type: 'contains',
                filter: 'boundaries',
                filterType: 'text',
              },
            },
          ],
        }),
      })
      .expect(200);

    expect(res.body.list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guid: createdTaskGuid,
          title: 'Define task system boundaries',
        }),
      ]),
    );
  });

  it('updates task status', async () => {
    await request(app.getHttpServer())
      .put(`/tasks/${createdTaskGuid}`)
      .send({ status: 'done' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/tasks/${createdTaskGuid}`)
      .expect(200);

    expect(res.body.status).toBe('done');
  });

  it('lists projects', async () => {
    const res = await request(app.getHttpServer()).get('/projects').expect(200);
    expect(res.body.list.length).toBeGreaterThanOrEqual(1);
  });

  it('lists project tasks through the standard task collection endpoint', async () => {
    const res = await request(app.getHttpServer())
      .get('/tasks')
      .query({ projectId: createdProjectGuid })
      .expect(200);

    expect(res.body.list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guid: createdTaskGuid,
          projectId: createdProjectGuid,
        }),
      ]),
    );
  });

  it('creates an event linked to the project', async () => {
    const guid = randomUUID();
    const res = await request(app.getHttpServer())
      .post('/events')
      .send({
        guid,
        title: 'Architecture review call',
        description: 'Review the first standalone event slice',
        status: 'scheduled',
        startAt: '2026-04-03T09:00:00.000Z',
        endAt: '2026-04-03T10:00:00.000Z',
        allDay: false,
        projectId: createdProjectGuid,
        location: 'Discord',
      })
      .expect(201);

    createdEventGuid = res.body.guid;
    expect(createdEventGuid).toBe(guid);
    expect(res.body.projectId).toBe(createdProjectGuid);
    expect(res.body.title).toBe('Architecture review call');
  });

  it('lists events', async () => {
    const res = await request(app.getHttpServer()).get('/events').expect(200);
    expect(res.body.list.length).toBeGreaterThanOrEqual(1);
  });

  it('updates event status', async () => {
    await request(app.getHttpServer())
      .put(`/events/${createdEventGuid}`)
      .send({ status: 'done' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/events/${createdEventGuid}`)
      .expect(200);

    expect(res.body.status).toBe('done');
  });

  it('creates an external reference for the task', async () => {
    const guid = randomUUID();
    const res = await request(app.getHttpServer())
      .post('/external-refs')
      .send({
        guid,
        internalType: 'task',
        internalId: createdTaskGuid,
        provider: 'google-tasks',
        account: 'default',
        container: 'primary',
        externalId: 'google-task-123',
      })
      .expect(201);

    createdExternalRefGuid = res.body.guid;
    expect(res.body.internalType).toBe('task');
    expect(res.body.internalId).toBe(createdTaskGuid);
    expect(res.body.provider).toBe('google-tasks');
  });

  it('lists external references', async () => {
    const res = await request(app.getHttpServer()).get('/external-refs').expect(200);
    expect(res.body.list.length).toBeGreaterThanOrEqual(1);
  });

  it('lists Omni-backed external references with structured REST filters', async () => {
    const res = await request(app.getHttpServer())
      .get('/external-refs')
      .query({
        filters: JSON.stringify({
          expressions: [
            {
              text: {
                field: 'provider',
                type: 'equals',
                filter: 'google-tasks',
                filterType: 'text',
              },
            },
          ],
        }),
      })
      .expect(200);

    expect(res.body.list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guid: createdExternalRefGuid,
          provider: 'google-tasks',
        }),
      ]),
    );
  });

  it('creates a sync state for the external reference', async () => {
    const guid = randomUUID();
    const res = await request(app.getHttpServer())
      .post('/sync-states')
      .send({
        guid,
        externalRefId: createdExternalRefGuid,
        status: 'active',
        lastDirection: 'push',
        remoteVersion: 'v1',
        localVersionHash: 'hash-1',
      })
      .expect(201);

    createdSyncStateGuid = res.body.guid;
    expect(res.body.externalRefId).toBe(createdExternalRefGuid);
    expect(res.body.status).toBe('active');
  });

  it('lists sync states', async () => {
    const res = await request(app.getHttpServer()).get('/sync-states').expect(200);
    expect(res.body.list.length).toBeGreaterThanOrEqual(1);
  });

  it('updates sync state and last error', async () => {
    await request(app.getHttpServer())
      .put(`/sync-states/${createdSyncStateGuid}`)
      .send({ status: 'error', lastError: 'Provider timeout' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/sync-states/${createdSyncStateGuid}`)
      .expect(200);

    expect(res.body.status).toBe('error');
    expect(res.body.lastError).toBe('Provider timeout');
  });

  it('returns a 400 error via YalcEventService', async () => {
    const res = await request(app.getHttpServer())
      .get('/tasks/errors/bad-request')
      .expect(400);

    expect(res.body.statusCode).toBe(400);
  });

  it('returns a 404 error via YalcEventService', async () => {
    const res = await request(app.getHttpServer())
      .get('/tasks/errors/not-found')
      .expect(404);

    expect(res.body.statusCode).toBe(404);
  });

  it('calls tasks list via NestHttpCallStrategy proxy', async () => {
    const res = await request(app.getHttpServer())
      .get('/tasks-proxy')
      .expect(200);

    expect(Array.isArray(res.body.list ?? res.body)).toBe(true);
  });

  it('uses YalcEventService for logging', async () => {
    const res = await request(app.getHttpServer())
      .get('/tasks-logging')
      .expect(200);

    expect(res.body).toEqual({ ok: true });
  });

  it('emits task domain events with module-specific logging', async () => {
    const res = await request(app.getHttpServer())
      .get('/tasks-events')
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(typeof res.body.taskId).toBe('string');
    expect(typeof res.body.projectId).toBe('string');
  });

  it('emits project domain events with module-specific logging', async () => {
    const res = await request(app.getHttpServer())
      .get('/projects-logging')
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(typeof res.body.projectId).toBe('string');
  });

  it('deletes the sync state', async () => {
    await request(app.getHttpServer())
      .delete(`/sync-states/${createdSyncStateGuid}`)
      .expect(200);
  });

  it('deletes the external reference', async () => {
    await request(app.getHttpServer())
      .delete(`/external-refs/${createdExternalRefGuid}`)
      .expect(200);
  });

  it('deletes the event', async () => {
    await request(app.getHttpServer())
      .delete(`/events/${createdEventGuid}`)
      .expect(200);
  });

  it('deletes the task', async () => {
    await request(app.getHttpServer())
      .delete(`/tasks/${createdTaskGuid}`)
      .expect(200);
  });
});
