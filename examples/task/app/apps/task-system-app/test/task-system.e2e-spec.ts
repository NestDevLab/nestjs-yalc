import { INestApplication, Module } from '@nestjs/common';
import { expect, jest } from '@jest/globals';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  NestHttpCallStrategy,
} from '@nestjs-yalc/api-strategy/strategies/nest-http-call.strategy.js';
import {
  NestLocalCallStrategy,
} from '@nestjs-yalc/api-strategy/strategies/nest-local-call.strategy.js';
import {
  OmniCollectionEntity,
  OmniDocumentEntity,
  OmniExternalRefEntity,
  OmniNamedEntity,
  OmniRecordEntity,
  OmniRelationEntity,
} from '@nestjs-yalc/omnikernel-module';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import { EventsModule } from '../src/events/events.module';
import { OmniTaskAppModule } from '../src/omni-task-app/omni-task-app.module';
import { ProjectsModule } from '../src/projects/projects.module';
import { SyncModule } from '../src/sync/sync.module';
import { TaskAppEventModule } from '../src/task-app-event.module';
import { TasksModule } from '../src/tasks/tasks.module';
import { AppModule } from '../src/app.module';

@Module({
  imports: [
    TaskAppEventModule,
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      entities: [
        OmniNamedEntity,
        OmniRecordEntity,
        OmniRelationEntity,
        OmniCollectionEntity,
        OmniDocumentEntity,
        OmniExternalRefEntity,
      ],
      synchronize: true,
    }),
    OmniTaskAppModule,
    TasksModule,
    ProjectsModule,
    EventsModule,
    SyncModule,
  ],
})
class LocalStrategyTestAppModule {}

describe('Task System App e2e', () => {
  let app: INestApplication;
  let fastifyApp: INestApplication;
  let httpStrategy: NestHttpCallStrategy;
  let localStrategy: NestLocalCallStrategy;
  let createdProjectGuid: string;
  let createdTaskGuid: string;
  let createdEventGuid: string;
  let createdExternalRefGuid: string;
  let createdSyncStateGuid: string;
  let previousTasksApiStrategy: string | undefined;
  let previousTasksHttpBaseUrl: string | undefined;

  beforeAll(async () => {
    previousTasksApiStrategy = process.env.TASKS_API_STRATEGY;
    previousTasksHttpBaseUrl = process.env.TASKS_HTTP_BASE_URL;
    process.env.TASKS_API_STRATEGY = 'http';
    process.env.TASKS_HTTP_BASE_URL = 'http://127.0.0.1:3000';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address?.port ? address.port : 0;
    process.env.TASKS_HTTP_BASE_URL = `http://127.0.0.1:${port}`;
    (app.get('TASKS_CLIENT_HTTP_API_STRATEGY') as any).baseUrl =
      process.env.TASKS_HTTP_BASE_URL;

    httpStrategy = new NestHttpCallStrategy(
      app.get(HttpService),
      { get: () => ({}) } as any,
      process.env.TASKS_HTTP_BASE_URL,
    );

    delete process.env.TASKS_API_STRATEGY;

    const fastifyModuleRef = await Test.createTestingModule({
      imports: [LocalStrategyTestAppModule],
    }).compile();

    fastifyApp = fastifyModuleRef.createNestApplication(new FastifyAdapter());
    await fastifyApp.init();

    localStrategy = new NestLocalCallStrategy(
      { httpAdapter: fastifyApp.getHttpAdapter() } as any,
      { get: () => ({}) } as any,
      { values: {} } as any,
    );
  });

  afterAll(async () => {
    await app?.close();
    await fastifyApp?.close();

    if (previousTasksApiStrategy === undefined) {
      delete process.env.TASKS_API_STRATEGY;
    } else {
      process.env.TASKS_API_STRATEGY = previousTasksApiStrategy;
    }

    if (previousTasksHttpBaseUrl === undefined) {
      delete process.env.TASKS_HTTP_BASE_URL;
    } else {
      process.env.TASKS_HTTP_BASE_URL = previousTasksHttpBaseUrl;
    }
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

  it('calls tasks list via NestHttpCallStrategy over real HTTP', async () => {
    const httpService = app.get(HttpService);
    const requestSpy = jest.spyOn(httpService.axiosRef, 'request');

    const res = await httpStrategy.get('/tasks');

    expect(res.status).toBe(200);
    expect(Array.isArray((res.data as any).list ?? res.data)).toBe(true);
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: `${process.env.TASKS_HTTP_BASE_URL}/tasks`,
      }),
    );
  });

  it('runs task workflows through the configured NestHttpCallStrategy', async () => {
    const httpService = app.get(HttpService);
    const requestSpy = jest.spyOn(httpService.axiosRef, 'request');
    const eventSpy = jest.spyOn(app.get(YalcEventService), 'log');
    requestSpy.mockClear();
    eventSpy.mockClear();

    const projectGuid = randomUUID();
    const taskGuid = randomUUID();

    const createRes = await request(app.getHttpServer())
      .post('/task-workflows/project-with-task')
      .send({
        project: {
          guid: projectGuid,
          name: 'HTTP workflow project',
          description: 'Created by the task workflow HTTP example',
          status: 'active',
        },
        task: {
          guid: taskGuid,
          title: 'HTTP workflow task',
          description: 'Created by the task workflow HTTP example',
          status: 'todo',
        },
      })
      .expect(201);

    expect(createRes.body.project.guid).toBe(projectGuid);
    expect(createRes.body.task.guid).toBe(taskGuid);
    expect(createRes.body.task.projectId).toBe(projectGuid);
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: `${process.env.TASKS_HTTP_BASE_URL}/projects`,
      }),
    );
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: `${process.env.TASKS_HTTP_BASE_URL}/tasks`,
      }),
    );
    expect(eventSpy).toHaveBeenCalledWith(
      ['task-system', 'tasks', 'created'],
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: taskGuid,
          projectId: projectGuid,
        }),
      }),
    );

    const backlogRes = await request(app.getHttpServer())
      .get('/task-workflows/backlog')
      .expect(200);
    expect(backlogRes.body.list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guid: taskGuid,
          projectId: projectGuid,
          status: 'todo',
        }),
      ]),
    );

    const projectTasksRes = await request(app.getHttpServer())
      .get(`/task-workflows/projects/${projectGuid}/tasks`)
      .expect(200);
    expect(projectTasksRes.body.list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guid: taskGuid,
          projectId: projectGuid,
        }),
      ]),
    );

    const completeRes = await request(app.getHttpServer())
      .put(`/task-workflows/tasks/${taskGuid}/complete`)
      .expect(200);
    expect(completeRes.body.task).toMatchObject({
      guid: taskGuid,
      status: 'done',
    });
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PUT',
        url: `${process.env.TASKS_HTTP_BASE_URL}/tasks/${taskGuid}`,
      }),
    );
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: `${process.env.TASKS_HTTP_BASE_URL}/tasks/${taskGuid}`,
      }),
    );
    expect(eventSpy).toHaveBeenCalledWith(
      ['task-system', 'tasks', 'status-changed'],
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: taskGuid,
          status: 'done',
        }),
      }),
    );
  });

  it('runs task workflows via NestLocalCallStrategy through Fastify inject', async () => {
    const eventSpy = jest.spyOn(fastifyApp.get(YalcEventService), 'log');
    eventSpy.mockClear();
    const localProjectGuid = randomUUID();
    const localTaskGuid = randomUUID();

    const createWorkflow = await localStrategy.post(
      '/task-workflows/project-with-task',
      {
        data: {
          project: {
            guid: localProjectGuid,
            name: 'Local workflow project',
            description: 'Created through Fastify inject',
            status: 'active',
          },
          task: {
            guid: localTaskGuid,
            title: 'Local workflow task',
            description: 'Created through NestLocalCallStrategy',
            status: 'todo',
          },
        },
      },
    );
    expect(createWorkflow.status).toBe(201);
    expect((createWorkflow.data as any).project.guid).toBe(localProjectGuid);
    expect((createWorkflow.data as any).task.guid).toBe(localTaskGuid);
    expect((createWorkflow.data as any).task.projectId).toBe(localProjectGuid);

    const backlogTasks = await localStrategy.get('/task-workflows/backlog');
    const projectTasks = await localStrategy.get(
      `/task-workflows/projects/${localProjectGuid}/tasks`,
    );

    expect(backlogTasks.status).toBe(200);
    expect((backlogTasks.data as any).list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guid: localTaskGuid,
          projectId: localProjectGuid,
          status: 'todo',
        }),
      ]),
    );
    expect(projectTasks.status).toBe(200);
    expect((projectTasks.data as any).list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guid: localTaskGuid,
          projectId: localProjectGuid,
        }),
      ]),
    );

    const completeTask = await localStrategy.call(
      `/task-workflows/tasks/${localTaskGuid}/complete`,
      {
        method: 'PUT',
      },
    );
    expect(completeTask.status).toBe(200);
    expect((completeTask.data as any).task).toMatchObject({
      guid: localTaskGuid,
      status: 'done',
    });
    expect(eventSpy).toHaveBeenCalledWith(
      ['task-system', 'tasks', 'created'],
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: localTaskGuid,
          projectId: localProjectGuid,
        }),
      }),
    );
    expect(eventSpy).toHaveBeenCalledWith(
      ['task-system', 'tasks', 'status-changed'],
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: localTaskGuid,
          status: 'done',
        }),
      }),
    );
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
