import { INestApplication } from '@nestjs/common';
import { expect } from '@jest/globals';
import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Task System App e2e', () => {
  let app: INestApplication;
  let createdProjectGuid: string;
  let createdTaskGuid: string;

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
        status: 'active'
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
        projectId: createdProjectGuid
      })
      .expect(201);

    createdTaskGuid = res.body.guid;
    expect(createdTaskGuid).toBe(guid);
    expect(res.body.projectId).toBe(createdProjectGuid);
  });

  it('lists tasks with pagination metadata', async () => {
    const res = await request(app.getHttpServer()).get('/tasks').expect(200);
    expect(res.body.list.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pageData).toMatchObject({ startRow: 0, count: expect.any(Number) });
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

  it('deletes the task', async () => {
    await request(app.getHttpServer()).delete(`/tasks/${createdTaskGuid}`).expect(200);
  });
});
