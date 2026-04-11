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

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [TestAppModule, HttpModule],
    }).compile();

    // Express app for HTTP strategy
    app = moduleFixture.createNestApplication();
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address?.port ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
    process.env.SKELETON_BASE_URL = baseUrl;
    httpService = moduleFixture.get(HttpService);

    // Fastify app for Local strategy inject (real inject)
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

    const proxyRes = await strategy.get('/users-proxy/phones');
    expect(proxyRes.status).toBe(200);
    const list = Array.isArray((proxyRes.data as any)?.list) ? (proxyRes.data as any).list : (proxyRes.data as any[]);
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

    const phonesRes = await localStrategy.get('/phones');
    expect(phonesRes.status).toBe(200);
    const list = Array.isArray((phonesRes.data as any)?.list) ? (phonesRes.data as any).list : (phonesRes.data as any[]);
    expect(Array.isArray(list)).toBe(true);
    const match = list.find((p: any) => String(p.phoneNumber) === '555555555');
    expect(match).toBeTruthy();
  });
});
