import {
  expect,
  jest,
  describe,
  it,
  beforeEach,
  beforeAll,
  afterAll,
  afterEach,
} from '@jest/globals';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { HttpService } from '@nestjs/axios';
import { AxiosInstance } from 'axios';
import {
  NestHttpCallStrategy,
  NestHttpCallStrategyProvider,
} from '../strategies/nest-http-call.strategy.js';
import { YalcGlobalClsService } from '../../../app/src/cls.module.js';

describe('NestHttpCallStrategy', () => {
  let httpService: HttpService;
  let clsService: DeepMocked<YalcGlobalClsService>;

  beforeEach(() => {
    const axiosRef = createMock<AxiosInstance>();
    httpService = createMock<HttpService>({
      axiosRef,
    });

    clsService = createMock<YalcGlobalClsService>();
  });

  it('should be defined', () => {
    expect(NestHttpCallStrategy).toBeDefined();
  });

  it('should be instantiable', () => {
    const instance = new NestHttpCallStrategy(httpService, clsService);
    expect(instance).toBeDefined();
  });

  it('should be able to execute the call method', async () => {
    const instance = new NestHttpCallStrategy(httpService, clsService);
    const result = await instance.call('http://localhost:3000', {
      method: 'GET',
    });
    expect(result).toBeDefined();
  });

  it('should be able to execute the get method', async () => {
    const instance = new NestHttpCallStrategy(httpService, clsService);
    const result = await instance.get('http://localhost:3000');
    expect(result).toBeDefined();
  });

  it('should be able to execute the post method', async () => {
    const instance = new NestHttpCallStrategy(httpService, clsService);
    const result = await instance.post('http://localhost:3000', {});
    expect(result).toBeDefined();
  });

  it('should create a provider', () => {
    const provider = NestHttpCallStrategyProvider('test');
    expect(provider).toBeDefined();
  });

  it('should create a provider and execute the useFactory method', () => {
    const provider = NestHttpCallStrategyProvider('test');
    expect(provider.useFactory(httpService, clsService)).toBeDefined();
  });

  it('should be able to execute the call method and return a json', async () => {
    const axiosRef = createMock<AxiosInstance>({
      request: (config: any) => ({ data: '{}' }),
    });
    httpService = createMock<HttpService>({
      axiosRef,
    });

    const instance = new NestHttpCallStrategy(httpService, clsService);
    const result = await instance.call('http://localhost:3000', {
      method: 'GET',
    });
    expect(result).toBeDefined();
  });

  it('should be able to execute the call method with parameters', async () => {
    const instance = new NestHttpCallStrategy(httpService, clsService);
    const result = await instance.call('http://localhost:3000', {
      method: 'GET',
      parameters: {
        test1: { test: 'test' },
      },
    });
    expect(result).toBeDefined();
  });

  it('should add internal request token header when provided', async () => {
    const requestSpy = jest.fn().mockResolvedValue({ data: '{}' });
    const axiosRef = createMock<AxiosInstance>({
      request: requestSpy as any,
    });
    httpService = createMock<HttpService>({
      axiosRef,
    });

    const instance = new NestHttpCallStrategy(
      httpService,
      clsService,
      'http://localhost:3000',
      {
        internalRequestHeader: 'x-internal-token',
        internalRequestToken: 'test-token-123',
      },
    );

    await instance.call('/test', {
      method: 'GET',
    });

    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-internal-token': 'test-token-123',
        }),
      }),
    );
  });

  it('should not override existing internal request token header', async () => {
    const requestSpy = jest.fn().mockResolvedValue({ data: '{}' });
    const axiosRef = createMock<AxiosInstance>({
      request: requestSpy as any,
    });
    httpService = createMock<HttpService>({
      axiosRef,
    });

    const instance = new NestHttpCallStrategy(
      httpService,
      clsService,
      'http://localhost:3000',
      {
        internalRequestHeader: 'x-internal-token',
        internalRequestToken: 'test-token-123',
      },
    );

    await instance.call('/test', {
      method: 'GET',
      headers: {
        'x-internal-token': 'user-provided-token',
      },
    });

    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-internal-token': 'user-provided-token',
        }),
      }),
    );
  });
});
