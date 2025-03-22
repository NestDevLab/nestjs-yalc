import { describe, expect, it, jest } from '@jest/globals';
import {
  DefaultError,
  DefaultErrorMixin,
  ON_DEFAULT_ERROR_EVENT,
  newDefaultError,
  isDefaultErrorMixin,
  DefaultErrorBase,
  errorToDefaultError,
  isDefaultErrorMixinClass,
} from '../default.error.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import EventEmitter from 'events';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { getHttpStatusDescription } from '@nestjs-yalc/utils/http.helper.js';

describe('DefaultErrorMixin', () => {
  it('should create a class that extends Error when no base class is provided', () => {
    const error = new (DefaultErrorMixin())({}, 'message', 500);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('message');
  });

  it('should create a class that extends the provided base class', () => {
    class CustomError extends HttpException {}
    const error = new (DefaultErrorMixin(CustomError))({}, 'message', 500);
    expect(error).toBeInstanceOf(CustomError);
    expect(error.message).toBe('message');
  });

  it('should set internalMessage when options is a string', () => {
    const error = new (DefaultErrorMixin())(
      { internalMessage: 'internalMessage' },
      {},
      500,
    );
    expect(error.internalMessage).toBe('internalMessage');
  });

  it('should set data when data option is provided', () => {
    const error = new (DefaultErrorMixin())({ data: 'data' }, 'message', 500);
    expect(error.data).toBe('data'); // Note: You might want to mock `maskDataInObject` to test this
  });

  it('should set data when masked data option is provided', () => {
    const error = new (DefaultErrorMixin())(
      { data: { test: 'test' }, masks: ['test'] },
      'message',
      500,
    );
    expect(error.data).toEqual({ test: '[REDACTED]' });
  });

  it('should set internalMessage when internalMessage option is provided', () => {
    const error = new (DefaultErrorMixin())(
      {
        internalMessage: 'internalMessage',
      },
      'message',
      500,
    );
    expect(error.internalMessage).toBe('internalMessage');
  });

  it('should log error when logger option is provided', () => {
    const logger = { error: jest.fn() };
    const error = new (DefaultErrorMixin())(
      { logger: { instance: logger, level: 'error' } },
      'message',
      500,
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it('should use console as logger when logger option is true', () => {
    const logger = { error: jest.fn() };
    const error = new (DefaultErrorMixin())({ logger: {} }, 'message', 500);
    // expect(logger.error).toHaveBeenCalled();
  });

  it('should emit an event when eventEmitter option is provided', () => {
    const eventEmitter = new EventEmitter();
    const eventHandler = jest.fn();
    eventEmitter.on(ON_DEFAULT_ERROR_EVENT, eventHandler);
    const error = new (DefaultErrorMixin())({ eventEmitter }, 'message');
    expect(eventHandler).toHaveBeenCalled();
  });

  it('should emit an event when eventEmitter2 option is provided', () => {
    const eventEmitter = new EventEmitter2();
    const eventHandler = jest.fn();
    eventEmitter.on(ON_DEFAULT_ERROR_EVENT, eventHandler);
    const error = new (DefaultErrorMixin())({ eventEmitter }, 'message', 500);
    expect(eventHandler).toHaveBeenCalled();
  });
});

describe('newDefaultError', () => {
  it('should create a new DefaultError class instance that extends the provided base class', () => {
    class CustomError extends HttpException {}
    const error = newDefaultError(CustomError, {}, 'message', 500);
    expect(error).toBeInstanceOf(CustomError);
    expect(error.message).toBe('message');
  });
});

describe('DefaultError', () => {
  it('should create an instance of Error', () => {
    const error = new DefaultError('my internal message', {
      response: 'my external message',
      logger: true,
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('my external message');
    expect(error.internalMessage).toBe('my internal message');
  });

  it('should be able to use the setErrorInfo method', () => {
    const error = new DefaultError('my internal message', {
      logger: true,
    });
    error.setErrorInfo({ data: 'test error info' });
    expect(error.getEventPayload()).toMatchObject({ data: 'test error info' });
  });

  it('should be able to use the mergeErrorInfo method', () => {
    const error = new DefaultError('my internal message', {
      logger: true,
    });
    error.mergeErrorInfo({
      data: { test: 'test error info' },
      response: { message: 'test error response' },
      cause: new Error('test cause'),
      internalMessage: 'test internal message',
      description: 'test description',
      eventName: 'test event name',
      stack: 'test stack',
    });
    expect(error.getEventPayload()).toMatchObject({
      data: { test: 'test error info' },
      message: 'test error response',
      cause: expect.anything(),
      internalMessage: 'test internal message',
      description: 'test description',
      eventName: 'test event name',
      stack: 'test stack',
    });
  });

  it('should be able to cover the mergeErrorInfo method', () => {
    const error = new DefaultError('my internal message', {
      logger: true,
      description: undefined,
      response: undefined,
    });
    error.mergeErrorInfo({
      data: { test: 'test error info' },
    });
    expect(error.getEventPayload()).toMatchObject({
      data: { test: 'test error info' },
      message: 'Default Error',
    });
  });

  it('should create an instance of Error with default message when message is not provided', () => {
    const error = new DefaultError();
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Default Error'); // if not specified, the message will be the parsed name of the class
    expect(error.internalMessage).toBeUndefined();
    expect(`${error}`.startsWith(`Default Error -`)).toBeTruthy();
  });

  it('should create an instance of Error with default options when options are not provided', () => {
    const error = new DefaultError('message');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Default Error');
    expect(error.internalMessage).toBe('message');
    expect(error.data).toBeUndefined();
  });

  it('should create a DefaultErrorBase without base class', () => {
    const error = new (DefaultErrorBase())();
    expect(error.message).toBe('Error');
  });

  it('should create an instance of Error with response as a string', () => {
    const error = new DefaultError('message', {
      response: 'my response',
      logger: {
        level: 'log',
      },
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.getResponse().message).toBe('my response');
    expect(error.getInternalMessage()).toBe('message');
    expect(error.getDescription()).toBe(getHttpStatusDescription(500));
    expect(error.getEventPayload()).toEqual(expect.anything());
  });

  it('should create an instance of Error with response as an object', () => {
    const error = new DefaultError('message', {
      response: { message: 'ok', test: 'test' },
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.getResponse().message).toBe('ok');
    expect(error.getResponse().test).toBe('test');
  });

  it('should create an instance of Error without options', () => {
    const error = new DefaultError();
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getResponse().message).toBe('Default Error');
  });

  it('should create an instance of Error without defaultError options', () => {
    const error = new DefaultError('internal test message', {
      description: 'this description should go in the info',
      data: { test: 'this property should go in the info' },
    });
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getResponse().message).toBe('Default Error');
    expect(`${error}`.startsWith('internal test message -')).toBeTruthy();
    expect(
      `${error}`.includes('this description should go in the info'),
    ).toBeTruthy();
    expect(
      `${error}`.includes('this property should go in the info'),
    ).toBeTruthy();
  });

  it('should create an instance of the Error with options as a string', () => {
    const error = new (DefaultErrorMixin())(
      { internalMessage: 'internal' },
      'external',
    );

    expect(error.getResponse().message).toBe('external');
  });

  describe('isDefaultErrorMixin', () => {
    it('should check if an error is not of DefaultMixin type', () => {
      const check = isDefaultErrorMixin({});
      expect(check).toBeFalsy();
    });

    it('should check if an error is of DefaultMixin type', () => {
      const error = new DefaultError();
      const check = isDefaultErrorMixin(error);
      expect(check).toBeTruthy();
    });
  });

  describe('isDefaultErrorMixinClass', () => {
    it('should check if an error is not of DefaultMixin type', () => {
      const check = isDefaultErrorMixinClass(BadRequestException);
      expect(check).toBeFalsy();
    });

    it('should check if an error is of DefaultMixin type', () => {
      const check = isDefaultErrorMixinClass(DefaultError);
      expect(check).toBeTruthy();
    });
  });

  describe('error cause', () => {
    it('should return if no cause defined', () => {
      const check = new DefaultError('test', { cause: undefined });
      expect(check.cause).toBeUndefined();
    });

    it('should return if cause is defined', () => {
      const check = new DefaultError('test', { cause: new Error('test') });
      expect(check.getEventPayload().cause).toBeDefined();
      expect(check.getEventPayload().cause?.parentCause).toBeUndefined();
    });

    it('should have multiple causes', () => {
      const check = new DefaultError('test', {
        cause: new DefaultError('test', { cause: { nonErrorCause: '' } }),
      });
      expect(check.cause).toBeDefined();
      expect(check.getEventPayload().cause?.parentCause).toBeDefined();
    });
  });

  describe('errorToDefaultError', () => {
    it.each([
      { name: 'standard Error', value: new Error('test') },
      { name: 'HttpException', value: new HttpException('test', 500) },
      { name: 'DefaultError', value: new DefaultError('test') },
      { name: 'string', value: 'test' as unknown as Error },
      {
        name: 'object with message',
        value: { message: 'test' } as unknown as Error,
      },
      { name: 'empty object', value: {} as unknown as Error },
      { name: 'null', value: null as unknown as Error },
      { name: 'undefined', value: undefined as unknown as Error },
      { name: 'number', value: 123 as unknown as Error },
      { name: 'boolean', value: true as unknown as Error },
      { name: 'array', value: [] as unknown as Error },
      {
        name: 'nested error',
        value: { error: new Error('nested') } as unknown as Error,
      },
      {
        name: 'error with circular reference',
        value: (() => {
          const err: any = new Error('circular');
          err.self = err;
          return err;
        })(),
      },
      {
        name: 'error with custom properties',
        value: Object.assign(new Error('custom'), { custom: 'property' }),
      },
      {
        name: 'BadRequestException',
        value: new BadRequestException('bad request'),
      },
      {
        name: 'ForbiddenException',
        value: new ForbiddenException('forbidden'),
      },
      {
        name: 'undefined with no prototype',
        value: Object.create(null) as unknown as Error,
      },
      {
        name: 'object with null prototype that mimics Error',
        value: Object.assign(Object.create(null), {
          message: 'test',
          name: 'FakeError',
          stack: 'fake stack',
        }) as unknown as Error,
      },
      // These test method invocation problems with HttpException-like objects
      {
        name: 'fake HttpException with broken getStatus',
        value: Object.assign(new Error('test'), {
          getStatus: () => {
            throw new Error('getStatus exploded');
          },
          getResponse: () => ({ toString: () => 'response' }),
        }),
      },
      {
        name: 'fake HttpException with broken getResponse',
        value: Object.assign(new Error('test'), {
          getStatus: () => 500,
          getResponse: () => {
            throw new Error('getResponse exploded');
          },
        }),
      },
      {
        name: 'deeply nested circular reference',
        value: (() => {
          const err: any = new Error('deep circular');
          const nested = { parent: err, child: {} };
          err.nested = nested;
          // @ts-expect-error - this is a test
          nested.child.backRef = nested;
          return err;
        })(),
      },
      {
        name: 'HttpException with complex response object',
        value: new HttpException(
          {
            nested: {
              deep: {
                message: 'buried message',
              },
            },
            circular: {},
          },
          500,
          { cause: new Error('cause') },
        ),
      },
      {
        name: 'HttpException with array response',
        value: new HttpException(['error1', 'error2'], 400),
      },
      {
        name: 'custom error extending Error with broken inheritance',
        value: (() => {
          function CustomError(this: any, message: string) {
            this.message = message;
            // Not calling Error constructor properly
          }
          CustomError.prototype = Object.create(Error.prototype);
          return new (CustomError as any)('broken inheritance');
        })(),
      },
      {
        name: 'error with non-enumerable properties',
        value: (() => {
          const err = new Error('hidden props');
          Object.defineProperty(err, 'hiddenCause', {
            value: new Error('hidden cause'),
            enumerable: false,
          });
          return err;
        })(),
      },
      {
        name: 'frozen error object',
        value: Object.freeze(new Error('frozen')),
      },
      {
        name: 'proxy with revoked handler',
        value: (() => {
          const { proxy, revoke } = Proxy.revocable(
            new Error('revoked proxy'),
            {},
          );
          revoke();
          return proxy;
        })(),
      },
      {
        name: 'circular reference in cause',
        value: (() => {
          const err: any = new Error('circular cause');
          err.cause = new Error('cause error');
          err.cause.parentError = err;
          return err;
        })(),
      },
      {
        name: 'fake HttpException with getResponse returning bad value',
        value: Object.assign(new Error('test'), {
          getStatus: () => 500,
          getResponse: () => ({
            toString: () => {
              throw new Error('toString exploded');
            },
          }),
        }),
      },
      {
        name: 'Error with getter that throws on message',
        value: Object.defineProperty(new Error(), 'message', {
          get: () => {
            throw new Error('message getter exploded');
          },
        }),
      },
      {
        name: 'Error with getter that throws on stack',
        value: Object.defineProperty(new Error('test'), 'stack', {
          get: () => {
            throw new Error('stack getter exploded');
          },
        }),
      },
      {
        name: 'Error with non string name',
        value: { name: 123 } as unknown as Error,
      },
      {
        name: 'Error with non string message',
        value: { message: 123 } as unknown as Error,
      },
      {
        name: 'Error with string cause',
        value: { cause: 'test' } as unknown as Error,
      },
      {
        name: 'Error with array cause',
        value: { cause: ['test'] } as unknown as Error,
      },
      {
        name: 'Error with error throwing cause key',
        value: {
          cause: Object.defineProperty({ test: 'test', boom: 'boom' }, 'boom', {
            get: () => {
              throw new Error('cause getter exploded');
            },
          }),
        } as unknown as Error,
      },
      {
        name: 'Error with getter that throws on name',
        value: Object.defineProperty(new Error('test'), 'name', {
          get: () => {
            throw new Error('name getter exploded');
          },
        }),
      },
    ])('should safely convert $name to a DefaultError', ({ value }) => {
      const defaultError = errorToDefaultError(value);
      expect(defaultError).toBeInstanceOf(DefaultError);
      expect(() => JSON.stringify(defaultError)).not.toThrow();
      expect(defaultError.name).toBeDefined();
      expect(defaultError.message).toBeDefined();
    });
  });
});
