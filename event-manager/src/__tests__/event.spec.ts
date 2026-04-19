import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

import {
  eventLogAsync,
  eventLog,
  eventErrorAsync,
  eventError,
  eventWarnAsync,
  eventWarn,
  eventDebugAsync,
  eventDebug,
  eventVerboseAsync,
  eventVerbose,
  event,
  type IEventOptions,
  IErrorEventOptions,
  getLoggerOption,
  resolveLoggerOption,
} from '../index.js';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { createMock } from '@golevelup/ts-jest';
import { DefaultError } from '@nestjs-yalc/errors/default.error.js';
import { LogLevelEnum, type ImprovedNestLogger } from '@nestjs-yalc/logger';
import { HttpException } from '@nestjs/common';

describe('Event Service', () => {
  let eventEmitter;
  let logger;
  let options: IErrorEventOptions;

  const systemMessage = 'systemMessage';

  beforeEach(() => {
    eventEmitter = createMock<EventEmitter2>(new EventEmitter2());
    jest.mocked(eventEmitter.emit).mockReturnValue(true);
    jest.mocked(eventEmitter.emitAsync).mockResolvedValue([]);
    logger = createMock<ImprovedNestLogger>();
    options = {
      data: { key: 'value' },
      mask: ['key'],
      stack: 'trace',
      event: {
        emitter: eventEmitter,
        formatter: jest.fn() as any,
      },
      logger: {
        instance: logger,
      },
      errorClass: DefaultError,
      message: systemMessage,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const message = 'test message';
  const eventName = 'testEvent';

  it('should log event asynchronously', async () => {
    await eventLogAsync(systemMessage, options);
    expect(logger.log).toHaveBeenCalledWith(systemMessage, expect.anything());
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
  });

  it('should resolve logger option', () => {
    const result = resolveLoggerOption(false);
    expect(result).toBeFalsy();
  });

  it('should get logger option when is string', () => {
    const result = getLoggerOption(LogLevelEnum.LOG, {
      logger: LogLevelEnum.DEBUG,
    });
    expect(result).toMatchObject({ level: LogLevelEnum.DEBUG });
  });

  it('should log event synchronously', () => {
    eventLog(systemMessage, options);
    expect(logger.log).toHaveBeenCalledWith(systemMessage, expect.anything());
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
  });

  it('should log error event asynchronously', async () => {
    await eventErrorAsync(systemMessage, options);
    expect(logger.error).toHaveBeenCalledWith(
      systemMessage,
      'trace',
      expect.anything(),
    );
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
  });

  it('should log error event synchronously', () => {
    eventError(systemMessage, options);
    expect(logger.error).toHaveBeenCalledWith(
      systemMessage,
      'trace',
      expect.anything(),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
  });

  it('should log error event synchronously without trace', () => {
    eventError(systemMessage, { ...options, trace: undefined });
    expect(logger.error).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
      expect.anything(),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
  });

  it('should build an error based from Error instance', () => {
    const error = new Error('test');
    const result = eventError(systemMessage, { ...options, errorClass: error });
    expect(result).toBeInstanceOf(Error);
  });

  it('should log warning event asynchronously', async () => {
    await eventWarnAsync(systemMessage, options);
    expect(logger.warn).toHaveBeenCalledWith(systemMessage, expect.anything());
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
  });

  it('should log warning event synchronously', () => {
    eventWarn(systemMessage, options);
    expect(logger.warn).toHaveBeenCalledWith(systemMessage, expect.anything());
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
  });

  it('should log debug event asynchronously', async () => {
    await eventDebugAsync(systemMessage, options);
    expect(logger.debug).toHaveBeenCalledWith(systemMessage, expect.anything());
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
  });

  it('should log debug event synchronously', () => {
    eventDebug(systemMessage, options);
    expect(logger.debug).toHaveBeenCalledWith(systemMessage, expect.anything());
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
  });

  it('should log verbose event asynchronously', async () => {
    await eventVerboseAsync(systemMessage, options);
    expect(logger.verbose).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
  });

  it('should log verbose event synchronously', () => {
    eventVerbose(systemMessage, options);
    expect(logger.verbose).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
  });

  it('should handle event without name', async () => {
    const _options: IEventOptions = {
      ...options,
      event: {
        emitter: eventEmitter,
        formatter: jest.fn() as any,
        await: true,
      },
    };
    await eventLog(systemMessage, _options);
    expect(logger.log).toHaveBeenCalledWith(systemMessage, expect.anything());
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
    );
  });

  it('should handle event with false', () => {
    const _options: IEventOptions = {
      ...options,
      event: false,
      message,
    };
    eventLog(message, _options);
    expect(logger.log).toHaveBeenCalledWith(message, expect.anything());
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('should handle event with string data', () => {
    eventLog(message, { ...options });
    expect(logger.log).toHaveBeenCalledWith(
      systemMessage,
      expect.objectContaining({
        data: expect.objectContaining({ errorName: 'DefaultError' }),
      }),
    );
  });

  it('should handle logger with false', () => {
    const _options: IEventOptions = {
      ...options,
      logger: false,
      message,
      data: { key: 'value' },
    };
    eventLog(systemMessage, _options);
    expect(logger.log).not.toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
  });

  it('should handle logger with options and data as a string', () => {
    const _options: IEventOptions = {
      ...options,
      data: 'data',
      logger: { instance: logger },
      message,
    };
    eventLog(systemMessage, _options);
    expect(logger.log).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
  });

  it('should handle logger without options', () => {
    eventLog(systemMessage);
  });

  it('should handle event without options', () => {
    event(systemMessage);
  });

  it('should handle event with partial options', () => {
    event(systemMessage, { logger: {} });
  });

  it('should handle error with false', () => {
    const _options: IErrorEventOptions = {
      ...options,
      errorClass: false,
      message,
    };
    eventError(systemMessage, _options);
    expect(logger.error).toHaveBeenCalledWith(
      message,
      'trace',
      expect.anything(),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
  });

  it('should handle error with true', () => {
    const _options: IErrorEventOptions = {
      ...options,
      errorClass: true,
      message,
    };
    const result = eventError(systemMessage, _options);
    expect(result).toBeInstanceOf(Error);
  });

  it('should handle error with errorClass undefined', () => {
    const _options: IErrorEventOptions = {
      ...options,
      errorClass: undefined,
      message,
    };
    const result = eventError(systemMessage, _options);
    expect(result).toBeInstanceOf(Error);
  });

  it('should handle error without options', () => {
    const result = eventError(systemMessage);
    expect(result).toBeInstanceOf(Error);
  });

  it('should handle error with class non DefaultError class (should not happen)', () => {
    class CustomError extends HttpException {}
    const _options: IErrorEventOptions = {
      ...options,
      errorClass: CustomError,
      message,
    };
    const result = eventError(systemMessage, _options);
    expect(result).toBeInstanceOf(CustomError);
    expect(result.message).toBe(`${message}`);
  });

  it('should handle error with true', async () => {
    const _options: IErrorEventOptions = {
      ...options,
      errorClass: true,
      message,
    };
    const result = event(systemMessage, _options);
    expect(result).toBeInstanceOf(DefaultError);
  });

  it('should handle error with class instance', async () => {
    const _options: IErrorEventOptions = {
      ...options,
      errorClass: new DefaultError(),
      message,
    };
    const result = event(systemMessage, _options);
    expect(result).toBeInstanceOf(DefaultError);
  });

  it('should handle events with eventAliases option', async () => {
    const _options: IEventOptions = {
      ...options,
      eventAliases: ['alias1', 'alias2', { eventName: 'alias3', await: false }],
    };
    await eventLogAsync(systemMessage, _options);
    expect(logger.log).toHaveBeenCalledWith(systemMessage, expect.anything());
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      systemMessage,
      expect.anything(),
    );
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      'alias1',
      expect.anything(),
    );
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      'alias2',
      expect.anything(),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'alias3',
      expect.anything(),
    );
  }
});
