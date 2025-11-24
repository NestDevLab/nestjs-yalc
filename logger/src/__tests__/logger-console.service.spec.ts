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
import { type ConsoleLogger as TConsoleLogger } from '../logger-console.service.js';

/**
 * Not sure why this is needed, but it is. Jest has reference errors when try to import the logger-console.service.js file
 * probably still caused by the ESM
 */
jest.unstable_mockModule('@nestjs-yalc/logger/logger.factory.js', async () => {
  return {
    AppLoggerFactory: jest.fn(),
  };
});

const { ConsoleLogger } = await import('../logger-console.service.js');
import { LOG_LEVEL_ALL } from '../logger.enum.js';

const logOptions = {
  context: 'test',
  data: { pass: 'data' },
  masks: ['pass'],
};

describe('Console logger service test', () => {
  let logger: TConsoleLogger;

  beforeEach(async () => {
    logger = new ConsoleLogger('test', LOG_LEVEL_ALL);
  });

  it('Test undefined levels', async () => {
    const methodLog = jest.spyOn(console, 'log');
    const methodError = jest.spyOn(console, 'error');
    const methodWarn = jest.spyOn(console, 'warn');
    logger = new ConsoleLogger('test', undefined);
    logger.log('test');
    logger.error('test');
    logger.warn('test');

    expect(methodLog).not.toHaveBeenCalled();
    expect(methodError).not.toHaveBeenCalled();
    expect(methodWarn).not.toHaveBeenCalled();
  });

  it('Test log', async () => {
    const method = jest.spyOn(console, 'log');
    logger.log('test');

    expect(method).toHaveBeenCalled();
  });

  it('Test log with options', async () => {
    const method = jest.spyOn(console, 'log');
    logger.log('test', logOptions);

    expect(method).toHaveBeenCalled();
  });

  it('Test error', async () => {
    const method = jest.spyOn(console, 'error');
    logger.error('error', 'trace', { data: 'test' });

    expect(method).toHaveBeenCalled();
    expect(method).toHaveBeenCalledWith('[test]', 'error', 'trace', {
      message: 'test',
    });
  });

  it('Test error with options', async () => {
    const method = jest.spyOn(console, 'error');
    logger.error('test', undefined, logOptions);

    expect(method).toHaveBeenCalled();
  });

  it('Test warn', async () => {
    const method = jest.spyOn(console, 'warn');
    logger.warn('warn');

    expect(method).toHaveBeenCalled();
  });

  it('Test warn with options', async () => {
    const method = jest.spyOn(console, 'warn');
    logger.warn('test', logOptions);

    expect(method).toHaveBeenCalled();
  });

  it('Test debug', async () => {
    const method = jest.spyOn(console, 'debug');
    logger.debug?.('debug');

    expect(method).toHaveBeenCalled();
  });

  it('Test debug with options', async () => {
    const method = jest.spyOn(console, 'debug');
    logger.debug?.('test', logOptions);

    expect(method).toHaveBeenCalled();
  });

  it('Test verbose', async () => {
    const method = jest.spyOn(console, 'info');
    logger.verbose?.('verbose');

    expect(method).toHaveBeenCalled();
  });

  it('Test verbose with options', async () => {
    const method = jest.spyOn(console, 'info');
    logger.verbose?.('test', logOptions);

    expect(method).toHaveBeenCalled();
  });

  it('setLogLevels should validate levels and emit events', async () => {
    const emitter = { emit: jest.fn() } as any;
    logger.setLogLevels(LOG_LEVEL_ALL);
    logger.error('boom', 'trace', { eventEmitter: emitter, useFallbackEvent: true });
    expect(emitter.emit).toHaveBeenCalled();
    emitter.emit.mockClear();
    logger.error('skip', 'trace', { eventEmitter: emitter, event: false as any });
    expect(emitter.emit).not.toHaveBeenCalled();
    expect(() => logger.setLogLevels(['invalid' as any])).toThrow();
  });
});
