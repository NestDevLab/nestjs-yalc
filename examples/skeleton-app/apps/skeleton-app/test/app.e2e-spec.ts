import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Skeleton App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns an empty users list with pagination metadata', async () => {
    const res = await request(app.getHttpServer()).get('/users').expect(200);

    expect(res.body.list).toEqual([]);
    expect(res.body.pageData).toMatchObject({ startRow: 0, count: 0 });
  });
});
