import { createMock } from '@golevelup/ts-jest';
import {
  jest,
  beforeEach,
  describe,
  it,
  beforeAll,
  expect,
} from '@jest/globals';
import { DefaultError } from '@nestjs-yalc/errors/default.error.js';
import { ImprovedLoggerService } from '@nestjs-yalc/logger/logger-abstract.service.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { YalcEventService } from '../event.service.js';
import {
  BadRequestError,
  InternalServerError,
} from '@nestjs-yalc/errors/error.class.js';
import { LogLevelEnum } from '@nestjs-yalc/logger/logger.enum.js';

describe('Event errorForward', () => {
  let service: YalcEventService;
  let mockLoggerService: Partial<ImprovedLoggerService>;
  let mockEventEmitter: Partial<EventEmitter2>;

  beforeAll(async () => {});

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLoggerService = createMock<ImprovedLoggerService>();

    mockEventEmitter = createMock<EventEmitter2>(new EventEmitter2());
    jest.mocked(mockEventEmitter.emit).mockReturnValue(true);
    jest.mocked(mockEventEmitter.emitAsync).mockResolvedValue([]);

    service = new YalcEventService(
      mockLoggerService as ImprovedLoggerService,
      mockEventEmitter as EventEmitter2,
    );
  });

  it('should call eventError with correct parameters for errorForward', () => {
    const forwardedError = service.errorForward(
      'testEvent',
      new Error('testError'),
    );

    const expectedObject = {
      internalMessage: 'testError',
      message: 'Default Error',
    };

    expect(forwardedError).toBeInstanceOf(DefaultError);
    expect(forwardedError).toMatchObject({ ...expectedObject, status: 500 });
    expect(mockLoggerService.error).toHaveBeenCalledWith(
      'testEvent',
      forwardedError.stack,
      expect.objectContaining({
        data: expect.objectContaining({ ...expectedObject, statusCode: 500 }),
      }),
    );
  });

  it('should call eventError with correct parameters for errorForward with BadRequestError with overridden data', () => {
    try {
      throw service.errorBadRequest('original error', {
        message: 'Internal message',
        response: { message: 'Response message original' },
        data: { key: 'value', key3: 'value3' },
      });
    } catch (error: any) {
      const expectedObject = {
        internalMessage: 'Bad request: Internal message',
        message: 'Response message new',
        data: expect.objectContaining({
          key: 'value',
          key2: 'value2',
          key3: 'valueNew',
        }),
      };

      const forwardedError = service.errorForward('forwarded error', error, {
        data: { key2: 'value2', key3: 'valueNew' },
        response: { message: 'Response message new' },
      });

      expect(forwardedError).toBeInstanceOf(BadRequestError);
      expect(forwardedError).toMatchObject({ ...expectedObject, status: 400 });
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        'forwarded error',
        expect.objectContaining({
          data: expect.objectContaining({ ...expectedObject, statusCode: 400 }),
        }),
      );
    }
  });

  it('should call eventError with correct parameters for errorForward with BadRequestError and overridden log level', () => {
    try {
      throw service.errorBadRequest('original error', {
        message: 'Internal message',
        response: { message: 'Response message' },
      });
    } catch (error: any) {
      const expectedObject = {
        internalMessage: 'Bad request: Internal message',
        message: 'Response message',
      };

      const forwardedError = service.errorForward('forwarded error', error, {
        logger: LogLevelEnum.ERROR,
      });

      expect(forwardedError).toBeInstanceOf(BadRequestError);
      expect(forwardedError).toMatchObject({ ...expectedObject, status: 400 });
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'forwarded error',
        error.stack,
        expect.objectContaining({
          data: expect.objectContaining({ ...expectedObject, statusCode: 400 }),
        }),
      );
    }
  });

  /**
   * This has a slightly different behaviour than the forward method
   * because it doesn't forward the internal error message,
   * but instead it uses the response message
   */
  it('should forward the error but triggering an internalServerError', () => {
    try {
      throw service.errorBadRequest('original error', {
        message: 'Internal message',
        response: { message: 'Response message' },
      });
    } catch (error: any) {
      const expectedObject = {
        internalMessage: 'Internal server error: forwarded error with cause',
        message: 'Internal Server Error',
      };

      const forwardedError = service.errorInternalServerError(
        'forwarded error with cause',
        {
          cause: error,
        },
      );

      expect(forwardedError).toBeInstanceOf(InternalServerError);
      expect(forwardedError).toMatchObject({ ...expectedObject, status: 500 });
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'forwarded error with cause',
        error.stack,
        expect.objectContaining({
          data: expect.objectContaining({ ...expectedObject, statusCode: 500 }),
        }),
      );
    }
  });
});
