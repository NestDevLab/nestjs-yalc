import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { StandaloneAppBootstrap } from '../app-bootstrap-standalone.helper.js';
import { NestFactory } from '@nestjs/core';

describe('StandaloneAppBootstrap', () => {
  const logger = { log: jest.fn(), debug: jest.fn() };
  const initMock = jest.fn().mockResolvedValue(undefined);
  const fakeApp = {
    init: initMock,
    close: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockReturnValue(logger),
    useLogger: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(NestFactory, 'createApplicationContext')
      .mockResolvedValue(fakeApp as any);
  });

  it('should create application context and initialize', async () => {
    const bootstrap = new StandaloneAppBootstrap(
      'standalone',
      class Dummy {},
      { skipMultiServerCheck: true } as any,
    );

    await bootstrap.initApp();

    expect(NestFactory.createApplicationContext).toHaveBeenCalled();
    expect(initMock).toHaveBeenCalled();
    expect(bootstrap.getApp()).toBe(fakeApp);
  });
});
