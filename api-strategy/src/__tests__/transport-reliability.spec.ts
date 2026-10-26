import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Controller, Get, Post, Res } from '@nestjs/common';
import { YalcGlobalClsService } from '@nestjs-yalc/app/cls.module.js';
import { MAIN_APP_CONFIG_SERVICE } from '@nestjs-yalc/app/def.const.js';
import { NestLocalCallStrategyProvider } from '../strategies/nest-local-call.strategy.js';
import { NestHttpCallStrategyProvider } from '../strategies/nest-http-call.strategy.js';
import { ApiCallStrategySelectorProvider } from '../strategy-selector.provider.js';
import {
  HttpStatusPolicyError,
  IHttpCallStrategy,
} from '../strategies/http-abstract-call.strategy.js';
import type { FastifyReply } from 'fastify';
let writes = 0;
let entered: () => void;
let release: () => void;
let gate: Promise<void>;
@Controller()
class FaultController {
  @Get('/unavailable') unavailable(@Res() reply: FastifyReply) {
    return reply.code(503).send({ reason: 'unavailable' });
  }
  @Get('/text') text(@Res() reply: FastifyReply) {
    return reply.type('text/plain').send('plain');
  }
  @Get('/disconnect')
  disconnect(@Res() reply: FastifyReply) { reply.raw.destroy(); }
  @Get('/ok') ok() {
    return { ok: true };
  }
  @Post('/write') async write() {
    writes++;
    entered();
    await gate;
    return { writes };
  }
}
describe('real Nest provider wiring and loopback transport faults', () => {
  let app: NestFastifyApplication;
  let local: IHttpCallStrategy;
  let http: IHttpCallStrategy;
  let strictLocal: IHttpCallStrategy;
  let strictHttp: IHttpCallStrategy;
  const validateStatus = (status: number) => status >= 200 && status < 300;
  beforeAll(async () => {
    const adapter = new FastifyAdapter();
    const module = await Test.createTestingModule({
      imports: [HttpModule],
      controllers: [FaultController],
      providers: [
        { provide: YalcGlobalClsService, useValue: { get: () => ({}) } },
        { provide: MAIN_APP_CONFIG_SERVICE, useValue: { values: {} } },
        NestLocalCallStrategyProvider('local'),
        NestLocalCallStrategyProvider('strictLocal', { validateStatus }),
        NestHttpCallStrategyProvider('http'),
        NestHttpCallStrategyProvider('strictHttp', { validateStatus }),
        { provide: 'selection', useValue: 'local' },
        ApiCallStrategySelectorProvider({
          provide: 'selected',
          strategies: { local: 'local', http: 'http' },
          defaultStrategy: 'http',
          selector: { inject: ['selection'], useFactory: async (key) => key },
        }),
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(adapter, {
      logger: false,
    });
    await app.listen(0, '127.0.0.1');
    local = app.get('local');
    strictLocal = app.get('strictLocal');
    const baseUrl = await app.getUrl();
    const rawHttp = app.get<IHttpCallStrategy>('http');
    const rawStrict = app.get<IHttpCallStrategy>('strictHttp');
    http = {
      call: (path, options) => rawHttp.call(`${baseUrl}${path}`, options),
      get: (path, options) => rawHttp.get(`${baseUrl}${path}`, options),
      post: (path, options) => rawHttp.post(`${baseUrl}${path}`, options),
    };
    strictHttp = {
      call: (path, options) => rawStrict.call(`${baseUrl}${path}`, options),
      get: (path, options) => rawStrict.get(`${baseUrl}${path}`, options),
      post: (path, options) => rawStrict.post(`${baseUrl}${path}`, options),
    };
    expect(app.get('selected')).toBe(local);
  });
  afterAll(async () => {
    release?.();
    await app?.close();
  });
  it('preserves the legacy 503 status difference', async () => {
    await expect(local.get('/unavailable')).resolves.toMatchObject({
      status: 503,
      data: { reason: 'unavailable' },
    });
    await expect(http.get('/unavailable')).rejects.toMatchObject({
      response: { status: 503 },
      isAxiosError: true,
    });
  });
  it.each(['local', 'http'])(
    'applies explicit status policy to real %s responses',
    async (transport) => {
      const strategy = transport === 'local' ? strictLocal : strictHttp;
      await expect(strategy.get('/unavailable')).rejects.toBeInstanceOf(
        HttpStatusPolicyError,
      );
      await expect(strategy.get('/ok')).resolves.toMatchObject({
        status: 200,
        data: { ok: true },
      });
      await expect(strategy.get('/text')).resolves.toMatchObject({
        data: 'plain',
      });
      await expect(
        strategy.get('/unavailable', { validateStatus: () => true }),
      ).resolves.toMatchObject({ status: 503 });
    },
  );
  it.each(['local', 'http'])(
    'does not execute already cancelled %s writes',
    async (transport) => {
      const signal = AbortSignal.abort();
      const before = writes;
      const strategy = transport === 'local' ? local : http;
      await expect(strategy.post('/write', { signal })).rejects.toBeDefined();
      expect(writes).toBe(before);
    },
  );
  it.each(['local', 'http'])(
    'cancels the %s caller without rolling back an in-flight write',
    async (transport) => {
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const controller = new AbortController();
      const before = writes;
      const strategy = transport === 'local' ? local : http;
      const execution = strategy.post('/write', { signal: controller.signal });
      await started;
      controller.abort();
      await expect(execution).rejects.toBeDefined();
      expect(writes).toBe(before + 1);
      release();
    },
  );
  it('surfaces a real socket reset without retrying and remains usable', async () => {
    await expect(http.get('/disconnect')).rejects.toMatchObject({
      code: 'ECONNRESET',
    });
    await expect(http.get('/ok')).resolves.toMatchObject({
      data: { ok: true },
    });
  });
});
