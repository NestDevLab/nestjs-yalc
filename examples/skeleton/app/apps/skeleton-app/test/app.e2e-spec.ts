import { INestApplication, Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { NestHttpCallStrategy, NestLocalCallStrategy } from '@nestjs-yalc/api-strategy';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkeletonUser } from '@nestjs-yalc/skeleton-module/src/skeleton-user.entity';
import { SkeletonPhone } from '@nestjs-yalc/skeleton-module/src/skeleton-phone.entity';
import { UsersModule } from '../src/users/users.module';
import { PhonesModule } from '../src/phones/phones.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      entities: [SkeletonUser, SkeletonPhone],
      synchronize: true,
    }),
    UsersModule,
    PhonesModule,
  ],
})
class TestAppModule {}

describe('Skeleton App (e2e)', () => {
  let app: INestApplication;
  let fastifyApp: INestApplication;
  let baseUrl: string;
  let httpService: HttpService;
  let localStrategy: NestLocalCallStrategy;
  let previousUsersApiStrategy: string | undefined;
  let previousUsersHttpBaseUrl: string | undefined;
  let previousSkeletonBaseUrl: string | undefined;

  beforeAll(async () => {
    previousUsersApiStrategy = process.env.USERS_API_STRATEGY;
    previousUsersHttpBaseUrl = process.env.USERS_HTTP_BASE_URL;
    previousSkeletonBaseUrl = process.env.SKELETON_BASE_URL;
    baseUrl = 'http://127.0.0.1:3000';
    process.env.USERS_API_STRATEGY = 'http';
    process.env.USERS_HTTP_BASE_URL = baseUrl;
    process.env.SKELETON_BASE_URL = baseUrl;

    const moduleFixture = await Test.createTestingModule({
      imports: [TestAppModule, HttpModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address?.port ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
    process.env.USERS_HTTP_BASE_URL = baseUrl;
    process.env.SKELETON_BASE_URL = baseUrl;
    (app.get('USERS_CLIENT_HTTP_API_STRATEGY') as any).baseUrl = baseUrl;
    httpService = moduleFixture.get(HttpService);

    process.env.USERS_API_STRATEGY = 'local';
    const fastifyFixture = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();
    fastifyApp = fastifyFixture.createNestApplication(new FastifyAdapter());
    await fastifyApp.init();
    await fastifyApp.listen(0);
    const fastifyAdapter = fastifyApp.getHttpAdapter();
    localStrategy = new NestLocalCallStrategy(
      { httpAdapter: fastifyAdapter } as any,
      { get: () => ({}) } as any,
      { values: {} } as any,
      '',
      {
        internalRequestHeader: 'x-internal-request-token',
        internalRequestToken: 'local-token',
      },
    );
  });

  afterAll(async () => {
    await app?.close();
    await fastifyApp?.close();

    if (previousUsersApiStrategy === undefined) {
      delete process.env.USERS_API_STRATEGY;
    } else {
      process.env.USERS_API_STRATEGY = previousUsersApiStrategy;
    }

    if (previousUsersHttpBaseUrl === undefined) {
      delete process.env.USERS_HTTP_BASE_URL;
    } else {
      process.env.USERS_HTTP_BASE_URL = previousUsersHttpBaseUrl;
    }

    if (previousSkeletonBaseUrl === undefined) {
      delete process.env.SKELETON_BASE_URL;
    } else {
      process.env.SKELETON_BASE_URL = previousSkeletonBaseUrl;
    }
  });

  it('returns an empty users list with pagination metadata', async () => {
    const res = await request(app.getHttpServer()).get('/users').expect(200);

    expect(res.body.list).toEqual([]);
    expect(res.body.pageData).toMatchObject({ startRow: 0, count: 0 });
  });

  it('returns users list via NestHttpCallStrategy', async () => {
    const strategy = new NestHttpCallStrategy(httpService, { get: () => ({}) } as any, baseUrl, {
      internalRequestHeader: 'x-internal-request-token',
      internalRequestToken: 'test-token',
    });
    const res = await strategy.get('/users');
    expect(res.status).toBe(200);
    expect(res.data?.list).toEqual([]);
  });

  it('creates and reads phones via HTTP strategy', async () => {
    const strategy = new NestHttpCallStrategy(httpService, { get: () => ({}) } as any, baseUrl, {});

    const userGuid = '11111111-1111-1111-1111-111111111111';
    const createUser = await strategy.post('/users', {
      data: {
        guid: userGuid,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'secret',
      },
    });
    expect(createUser.status).toBe(201);

    const createRes = await strategy.post('/phones', {
      data: {
        phoneNumber: '123456789',
        userId: userGuid,
      },
    });
    expect(createRes.status).toBe(201);

    const clientRes = await strategy.get('/users-client/phones');
    expect(clientRes.status).toBe(200);
    const list = Array.isArray((clientRes.data as any)?.list) ? (clientRes.data as any).list : (clientRes.data as any[]);
    expect(Array.isArray(list)).toBe(true);
    expect(list.find((p: any) => p.phoneNumber === '123456789')).toBeTruthy();
  });

  it('creates and reads phones via Local strategy inject', async () => {
    const localUserGuid = '33333333-3333-3333-3333-333333333333';
    const createUser = await localStrategy.post('/users', {
      data: {
        guid: localUserGuid,
        firstName: 'Local',
        lastName: 'User',
        email: 'local@example.com',
        password: 'secret',
      },
    });
    expect(createUser.status).toBe(201);

    const createRes = await localStrategy.post('/phones', {
      data: {
        phoneNumber: '555555555',
        userId: localUserGuid,
      },
    });
    expect(createRes.status).toBe(201);

    const phonesRes = await localStrategy.get('/users-client/phones');
    expect(phonesRes.status).toBe(200);
    const list = Array.isArray((phonesRes.data as any)?.list) ? (phonesRes.data as any).list : (phonesRes.data as any[]);
    expect(Array.isArray(list)).toBe(true);
    const match = list.find((p: any) => String(p.phoneNumber) === '555555555');
    expect(match).toBeTruthy();
  });
});
