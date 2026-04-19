import {
  expect,
  jest,
  describe,
  it,
  beforeEach,
  afterEach,
} from '@jest/globals';

import { Logger } from 'pino';
import { PinoLogger, FLUSH_INTERVAL, flush } from '../index.js';
import { LOG_LEVEL_ALL } from '../logger.enum.js';

const logOptions = {
  context: 'test',
  data: { pass: 'data' },
  masks: ['pass'],
};

describe('Pino logger service test', () => {
  let pino: Logger;
  const container: { logger?: PinoLogger } = {
    logger: new PinoLogger('test', LOG_LEVEL_ALL),
  };

  beforeEach(async () => {
    container.logger = new PinoLogger('test', LOG_LEVEL_ALL);
    pino = container.logger?.getLogger();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Test log', async () => {
    const method = jest.spyOn(pino, 'info');
    container.logger?.log('test');

    expect(method).toHaveBeenCalled();
  });

  it('Test log with options', async () => {
    const method = jest.spyOn(pino, 'info');
    container.logger?.log('info', logOptions);

    expect(method).toHaveBeenCalled();
  });

  it('Test error', async () => {
    const method = jest.spyOn(pino, 'error');
    container.logger?.error('error', 'trace');

    expect(method).toHaveBeenCalled();
    // expect(method).toHaveBeenCalledWith({ context: 'test' }, 'error trace');
  });

  it('Test error with options', async () => {
    const method = jest.spyOn(pino, 'error');
    container.logger?.error('error', undefined, logOptions);

    expect(method).toHaveBeenCalled();
  });

  it('Test warn', async () => {
    const method = jest.spyOn(pino, 'warn');
    container.logger?.warn('warn');

    expect(method).toHaveBeenCalled();
  });

  it('Test warn with options', async () => {
    const method = jest.spyOn(pino, 'warn');
    container.logger?.warn('warn', logOptions);

    expect(method).toHaveBeenCalled();
  });

  it('Test debug', async () => {
    const method = jest.spyOn(pino, 'debug');
    container.logger?.debug?.('debug');

    expect(method).toHaveBeenCalled();
  });

  it('Test debug with options', async () => {
    const method = jest.spyOn(pino, 'debug');
    container.logger?.debug?.('debug', logOptions);

    expect(method).toHaveBeenCalled();
  });

  it('Test verbose with options', async () => {
    const method = jest.spyOn(pino, 'trace');
    container.logger?.verbose?.('verbose', logOptions);

    expect(method).toHaveBeenCalled();
  });

  it('Test verbose & flush', async () => {
    jest.useFakeTimers();

    jest.mock('process', () => ({
      on: jest.fn((fn) => {
        fn();
      }),
    }));

    const _logger = new PinoLogger('test', LOG_LEVEL_ALL);

    const method = jest.spyOn(pino, 'trace');
    _logger.verbose?.('verbose');

    // Fast-forward until all timers have been executed
    jest.advanceTimersByTime(FLUSH_INTERVAL + 1000);

    expect(method).toHaveBeenCalled();
  });

  it('Test on application shutdown', async () => {
    const method = jest.spyOn(pino, 'info');
    container.logger?.log('test');
    await container.logger?.onApplicationShutdown();
    expect(method).toHaveBeenCalledWith({ context: 'test' }, 'test');
  });

  it('Test flush when logger has been destroyed', async () => {
    const method = jest.spyOn(pino, 'flush');
    method.mockImplementation((callback: any) => {
      callback();
    });

    delete container.logger;
    await flush();
    expect(container.logger).toBeUndefined();
    expect(method).toHaveBeenCalled();
  });

  it('Test flush with error', async () => {
    const method = jest.spyOn(pino, 'flush');
    method.mockImplementation((callback: any) => {
      callback(new Error('test'));
    });

    expect(
      async () => await container.logger?.onApplicationShutdown(),
    ).rejects.toThrow();
    expect(method).toHaveBeenCalled();
  });
});
