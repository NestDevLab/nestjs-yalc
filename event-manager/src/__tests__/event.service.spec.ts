import {
  jest,
  beforeEach,
  describe,
  expect,
  it,
  beforeAll,
} from '@jest/globals';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ImprovedLoggerService } from '@nestjs-yalc/logger/logger-abstract.service.js';
import { createMock } from '@golevelup/ts-jest';
import type { YalcEventService as EventServiceType } from '../event.service.js';
import { HttpStatus } from '@nestjs/common';

jest.unstable_mockModule('../event.js', async () => {
  return {
    eventLogAsync: jest.fn(),
    eventDebugAsync: jest.fn(),
    eventErrorAsync: jest.fn(),
    eventVerboseAsync: jest.fn(),
    eventWarnAsync: jest.fn(),
    eventException: jest.fn(),
    eventDebug: jest.fn(),
    eventError: jest.fn(),
    eventLog: jest.fn(),
    eventVerbose: jest.fn(),
    eventWarn: jest.fn(),
    event: jest.fn(),
    setGlobalEventEmitter: jest.fn(),
    getGlobalEventEmitter: jest.fn(),
    resolveLoggerOption: jest.fn(),
    isErrorOptions: jest.fn().mockReturnValue(true),
    applyAwaitOption: (options) => options, // stupid workaround because of jest limitations with mocking esm modules
  };
});
const { YalcEventService } = await import('../event.service.js');
const {
  eventLogAsync,
  eventDebugAsync,
  eventErrorAsync,
  eventVerboseAsync,
  eventWarnAsync,
  eventDebug,
  eventError,
  eventLog,
  eventVerbose,
  eventWarn,
  isErrorOptions,
} = await import('../event.js');

isErrorOptions;

describe('YalcEventService', () => {
  let service: EventServiceType;
  let mockLoggerService: Partial<ImprovedLoggerService>;
  let mockEventEmitter: Partial<EventEmitter2>;

  beforeAll(async () => {});

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLoggerService = createMock<ImprovedLoggerService>();

    mockEventEmitter = createMock<EventEmitter2>(new EventEmitter2());

    jest.mocked(isErrorOptions).mockReturnValue(true);

    service = new YalcEventService(
      mockLoggerService as ImprovedLoggerService,
      mockEventEmitter as EventEmitter2,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logger', () => {
    it('should return logger service', () => {
      expect(service.logger).toBe(mockLoggerService);
    });
  });

  describe('emitter', () => {
    it('should return event emitter', () => {
      expect(service.emitter).toBe(mockEventEmitter);
    });

    it('should emit event with logging', () => {
      service.log('testEvent with logging');
      expect(eventLog).toHaveBeenCalled();
    });

    it('should emit event without logging', () => {
      service.log('testEvent without logging', { logger: false });
      expect(mockLoggerService.log).not.toHaveBeenCalled();
    });
  });

  describe('logAsync', () => {
    it('should call eventLogAsync with correct parameters', () => {
      service.logAsync('testEvent');
      expect(eventLogAsync).toHaveBeenCalledWith(
        'testEvent',
        expect.anything(),
      );
    });
  });

  describe('errorHttp', () => {
    it('should call errorHttp with logger disabled', () => {
      service.errorHttp('testEvent', HttpStatus.INTERNAL_SERVER_ERROR, {
        logger: false,
      });
      expect(eventError).toHaveBeenCalledWith('testEvent', expect.anything());
    });

    it('should call errorHttp with special case', () => {
      service.errorHttp('testEvent', HttpStatus.TOO_MANY_REQUESTS);
      expect(eventError).toHaveBeenCalledWith('testEvent', expect.anything());
    });

    it('should call errorHttp with >400 codes', () => {
      service.errorHttp('testEvent', HttpStatus.BAD_REQUEST);
      expect(eventError).toHaveBeenCalledWith('testEvent', expect.anything());
    });
    it('should call buildErrorOptions without passing in defaultClass', () => {
      expect(() => {
        service.buildErrorOptions({
          data: { response: { thisError: 'this error' } },
        });
      }).not.toThrow();
    });
  });

  describe('errorAsync', () => {
    it('should call eventErrorAsync with correct parameters', () => {
      service.errorAsync('testEvent');
      expect(eventErrorAsync).toHaveBeenCalledWith(
        'testEvent',
        expect.anything(),
      );
    });
  });

  describe('warnAsync', () => {
    it('should call eventWarnAsync with correct parameters', () => {
      service.warnAsync('testEvent');
      expect(eventWarnAsync).toHaveBeenCalledWith(
        'testEvent',
        expect.anything(),
      );
    });
  });

  describe('debugAsync', () => {
    it('should call eventDebugAsync with correct parameters', () => {
      service.debugAsync('testEvent');
      expect(eventDebugAsync).toHaveBeenCalledWith(
        'testEvent',
        expect.anything(),
      );
    });
  });

  describe('verboseAsync', () => {
    it('should call eventVerboseAsync with correct parameters', () => {
      service.verboseAsync('testEvent');
      expect(eventVerboseAsync).toHaveBeenCalledWith(
        'testEvent',
        expect.anything(),
      );
    });
  });

  describe('log', () => {
    it('should call eventLog with correct parameters', () => {
      service.log('testEvent');
      expect(eventLog).toHaveBeenCalledWith('testEvent', expect.anything());
    });
  });

  describe('error', () => {
    it('should call eventError with correct parameters', () => {
      service.error('testEvent');
      expect(eventError).toHaveBeenCalledWith('testEvent', expect.anything());
    });

    it('should call errorForward with correct parameters', () => {
      service.errorForward('testEvent', new Error('test error'));
      expect(eventError).toHaveBeenCalledWith('testEvent', expect.anything());
    });

    it('should call errorForwardResult with correct parameters', () => {
      service.errorForwardResult('testEvent', new Error('test error'));
      expect(eventError).toHaveBeenCalledWith('testEvent', expect.anything());
    });

    it('should call errorForwardFromFn with correct parameters', async () => {
      await service.errorForwardFromFn('testEvent', () =>
        Promise.reject(new Error('test error')),
      );

      expect(eventError).toHaveBeenCalledWith('testEvent', expect.anything());
    });

    it('should not call errorForwardFromFn with correct parameters', async () => {
      await service.errorForwardFromFn('testEvent', () => Promise.resolve());
      expect(eventError).not.toHaveBeenCalled();
    });

    it('should not construct error from promise if it resolved', async () => {
      await service.errorForwardFromFn('testEvent', () => Promise.resolve());
      // Await for the promise to be resolved
      await new Promise((resolve) => setTimeout(resolve, 1));
      expect(eventError).not.toHaveBeenCalled();
    });

    it('should construct error from promise if it rejected', async () => {
      await service.errorForwardFromFn('testEvent', () => Promise.reject());
      expect(eventError).toHaveBeenCalledWith('testEvent', expect.anything());
    });

    it('should construct result error', () => {
      service.errorResult('testEvent');
      expect(eventError).toHaveBeenCalledWith('testEvent', expect.anything());
    });

    function getErrorMethods(instance: any): string[] {
      return Object.getOwnPropertyNames(Object.getPrototypeOf(instance)).filter(
        (methodName) =>
          methodName.startsWith('error') &&
          methodName !== 'errorAsync' &&
          methodName !== 'errorForward' && // error forward is tested separately
          methodName !== 'errorForwardResult' &&
          methodName !== 'errorForwardFromFn' &&
          typeof instance[methodName] === 'function',
      );
    }

    const errorMethods = getErrorMethods(
      new YalcEventService({} as any, {} as any),
    );

    it.each(errorMethods)(
      'should call eventError with correct parameters for %s',
      async (methodName) => {
        if (methodName.endsWith('FromFn')) {
          const err = await service[methodName]('testEvent', () =>
            Promise.reject(),
          );
          expect(eventError).toHaveBeenCalledWith(
            'testEvent',
            expect.anything(),
          );
          expect(err.isErr()).toBe(true);
        } else {
          service[methodName]('testEvent');
          expect(eventError).toHaveBeenCalledWith(
            'testEvent',
            expect.anything(),
          );
        }
      },
    );

    const errorMethodsFromFn = errorMethods.filter((m) => m.endsWith('FromFn'));
    it.each(errorMethodsFromFn)(
      'should call eventErrorFromFn with correct parameters for %s',
      async (methodName) => {
        const res = await service[methodName]('testEvent', async () => {
          return Promise.resolve('test');
        });
        expect(eventError).not.toHaveBeenCalled();
        expect(res.isOk()).toBe(true);
        expect(res.value).toEqual('test');
      },
    );

    it('should call eventErrorAsync with correct parameters', () => {
      service.errorAsync('testEvent');
      expect(eventErrorAsync).toHaveBeenCalledWith(
        'testEvent',
        expect.anything(),
      );
    });
  });

  describe('warn', () => {
    it('should call eventWarn with correct parameters', () => {
      service.warn('testEvent');
      expect(eventWarn).toHaveBeenCalledWith('testEvent', expect.anything());
    });
  });

  describe('debug', () => {
    it('should call eventDebug with correct parameters', () => {
      service.debug('testEvent');
      expect(eventDebug).toHaveBeenCalledWith('testEvent', expect.anything());
    });
  });

  describe('verbose', () => {
    it('should call eventVerbose with correct parameters', () => {
      service.verbose('testEvent');
      expect(eventVerbose).toHaveBeenCalledWith('testEvent', expect.anything());
    });
  });

  describe('buildOptions', () => {
    beforeEach(() => {
      jest.mocked(isErrorOptions).mockReturnValue(false);
    });

    it('should correctly merge options', () => {
      const options = service['buildOptions']({ event: false });
      expect(options).toEqual({ event: false, logger: expect.anything() });
    });

    it('should correctly merge options with logger false', () => {
      const options = service['buildOptions']({ event: false, logger: false });
      expect(options).toEqual({ event: false, logger: false });
    });
  });
});
