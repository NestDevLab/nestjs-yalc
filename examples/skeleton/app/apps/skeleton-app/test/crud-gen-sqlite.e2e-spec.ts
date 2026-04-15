import { INestApplication } from '@nestjs/common';
import { expect, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpService } from '@nestjs/axios';

describe('Crud-gen REST (SQLite in-memory) e2e', () => {
  let app: INestApplication;
  let createdGuid: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const httpService = app.get(HttpService);
    jest.spyOn(httpService.axiosRef, 'request').mockImplementation(
      async (config: any) => {
        // Proxy the call to the in-app /users endpoint to avoid real HTTP
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
      },
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('creates a user', async () => {
    const guid = randomUUID();
    const res = await request(app.getHttpServer())
      .post('/users')
      .send({
        guid,
        firstName: 'Alice',
        lastName: 'Doe',
        email: 'alice@example.com',
        password: 'P@ssw0rd!',
      })
      .expect(201);

    createdGuid = res.body.guid;
    expect(createdGuid).toBe(guid);
    expect(res.body.firstName).toBe('Alice');
  });

  it('lists users with pagination metadata', async () => {
    const res = await request(app.getHttpServer()).get('/users').expect(200);
    expect(res.body.list.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pageData).toMatchObject({
      startRow: 0,
      count: expect.any(Number),
    });
  });

  it('lists users with structured REST sorting and filters', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .query({
        sorting: JSON.stringify([{ colId: 'firstName', sort: 'ASC' }]),
        filters: JSON.stringify({
          expressions: [
            {
              text: {
                field: 'firstName',
                type: 'contains',
                filter: 'Alice',
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
          guid: createdGuid,
          firstName: 'Alice',
        }),
      ]),
    );
  });

  it('rejects malformed structured REST filters', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .query({ filters: '{bad-json' })
      .expect(400);
  });

  it('updates a user', async () => {
    await request(app.getHttpServer())
      .put(`/users/${createdGuid}`)
      .send({ lastName: 'Updated' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/users/${createdGuid}`)
      .expect(200);
    expect(res.body.lastName).toBe('Updated');
  });

  it('paginates with startRow/endRow', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .query({ startRow: 0, endRow: 1 })
      .expect(200);

    expect(res.body.list.length).toBeLessThanOrEqual(1);
    expect(Number(res.body.pageData.endRow)).toBe(1);
  });

  it('deletes a user', async () => {
    await request(app.getHttpServer())
      .delete(`/users/${createdGuid}`)
      .expect(200);
  });

  it('returns a 400 error via YalcEventService', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/errors/bad-request')
      .expect(400);

    expect(res.body.statusCode).toBe(400);
  });

  it('returns a 404 error via YalcEventService', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/errors/not-found')
      .expect(404);

    expect(res.body.statusCode).toBe(404);
  });

  it('calls users list via NestHttpCallStrategy proxy', async () => {
    const res = await request(app.getHttpServer())
      .get('/users-proxy')
      .expect(200);

    expect(Array.isArray(res.body.list ?? res.body)).toBe(true);
  });

  it('validates create payload via users-validation controller', async () => {
    const valid = await request(app.getHttpServer())
      .post('/users-validation')
      .send({
        firstName: 'Valid',
        lastName: 'User',
        email: 'valid.user@example.com',
        password: 'StrongP@ss1',
      })
      .expect(201);

    expect(valid.body.guid).toBeDefined();
  });

  it('rejects invalid payload via users-validation controller', async () => {
    await request(app.getHttpServer())
      .post('/users-validation')
      .send({
        firstName: '123',
        lastName: 'User',
        email: 'not-an-email',
        password: 'short',
      })
      .expect(400);
  });

  it('uses YalcEventService via users-logging controller', async () => {
    const res = await request(app.getHttpServer())
      .get('/users-logging')
      .expect(200);

    expect(res.body).toEqual({ ok: true });
  });
});
