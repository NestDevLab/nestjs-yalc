import { INestApplication } from '@nestjs/common';
import { expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Crud-gen REST (SQLite) e2e', () => {
  let app: INestApplication;
  let createdGuid: string;

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
    expect(res.body.pageData).toMatchObject({ startRow: 0, count: expect.any(Number) });
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
    await request(app.getHttpServer()).delete(`/users/${createdGuid}`).expect(200);
  });
});
