import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { BaseAppController } from '../base-app.controller.js';
import { BaseAppService } from '../base-app.service.js';

class TestAppController extends BaseAppController {}

describe('BaseAppController', () => {
  const getHello = jest.fn();
  const appService = {
    getHello,
  } as unknown as BaseAppService;

  const configGet = jest.fn();
  const configService = {
    get: configGet,
  } as unknown as ConfigService;

  let controller: TestAppController;
  let exitSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TestAppController(appService, configService);
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as any);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('should call BaseAppService with configured app name', () => {
    configGet.mockReturnValue({ appName: 'sample-app' });
    getHello.mockReturnValue('Hello World from sample-app!');

    const result = controller.getHello();

    expect(result).toBe('Hello World from sample-app!');
    expect(getHello).toHaveBeenCalledWith('sample-app');
  });

  it('should fallback to default app name when missing', () => {
    configGet.mockReturnValue(undefined);
    getHello.mockReturnValue('Hello World from no-name!');

    controller.getHello();

    expect(getHello).toHaveBeenCalledWith('no-name');
  });

  it('should terminate when shutdown is called in dev/test env', () => {
    configGet.mockReturnValue({ isDev: true });

    controller.shutdown();

    expect(logSpy).toHaveBeenCalledWith('Bye bye!');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should ignore shutdown when not in dev/test env', () => {
    configGet.mockReturnValue({ isDev: false, isTest: false });

    controller.shutdown();

    expect(exitSpy).not.toHaveBeenCalled();
  });
});
