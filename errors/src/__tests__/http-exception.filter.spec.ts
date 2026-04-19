import { expect, jest, describe, it, beforeEach } from '@jest/globals';

import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { CreateEntityError } from '@nestjs-yalc/crud-gen/entity.error.js';
import { MissingArgumentsError } from '@nestjs-yalc/crud-gen/missing-arguments.error.js';
import {
  ArgumentsHost,
  BadRequestException,
  InternalServerErrorException,
  LoggerService,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../filters/http-exception.filter.js';
import { GqlError } from '@nestjs-yalc/graphql/plugins/gql.error.js';
import { DefaultError } from '../index.js';
jest.mock('@nestjs/graphql');

describe('Http exceptions filter', () => {
  let filter: HttpExceptionFilter;
  let loggerServiceMock: DeepMocked<LoggerService>;
  let mockArgumentsHost: DeepMocked<ArgumentsHost>;

  beforeEach(() => {
    jest.resetAllMocks();
    loggerServiceMock = createMock<LoggerService>();
    mockArgumentsHost = createMock<ArgumentsHost>();
    filter = new HttpExceptionFilter(loggerServiceMock);
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should catch and log Application errors', () => {
    const error = new MissingArgumentsError();

    filter.catch(error, mockArgumentsHost);
    expect(loggerServiceMock.log).toHaveBeenCalledWith(
      error.message,
      expect.anything(),
    );
  });

  it('should catch Default error', () => {
    const exception = new DefaultError('test');

    filter.catch(exception, mockArgumentsHost);
  });

  it('should catch and log System Error error', () => {
    const exception = new Error('test');

    filter.catch(exception, mockArgumentsHost);
    expect(loggerServiceMock.error).toHaveBeenCalledWith(
      exception.message,
      exception.stack,
      expect.anything(),
    );
  });

  it('should catch and log Entity error', () => {
    const exception = new CreateEntityError();

    filter.catch(exception, mockArgumentsHost);
    expect(loggerServiceMock.error).toHaveBeenCalledWith(
      exception,
      undefined,
      expect.anything(),
    );
  });

  it('should catch EntityError and log the original message', () => {
    const fixedError = new Error('message');
    const exception = new CreateEntityError(fixedError);

    filter.catch(exception, mockArgumentsHost);
    expect(loggerServiceMock.error).toHaveBeenCalledWith(
      fixedError.message,
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'CreateEntityError',
        }),
      }),
    );
  });

  it('should catch and log GqlError error', () => {
    const exception: GqlError = new GqlError('message', 'systemMessage');
    filter.catch(exception, mockArgumentsHost);
    expect(loggerServiceMock.error).toHaveBeenCalledWith(exception.systemMessage);

    exception.systemMessage = undefined;
    filter.catch(exception, mockArgumentsHost);
    expect(loggerServiceMock.error).toHaveBeenCalledWith(exception.message);
  });

  it('should catch and log Http error with host type http', () => {
    const exception = new InternalServerErrorException();
    mockArgumentsHost.getType.mockReturnValue('http');
    filter.catch(exception, mockArgumentsHost as ArgumentsHost);
    expect(loggerServiceMock.error).toHaveBeenCalledWith(
      exception.message,
      exception.stack,
      expect.anything(),
    );
  });

  it('should catch and log Http log with host type http', () => {
    const exception = new BadRequestException();
    mockArgumentsHost.getType.mockReturnValue('http');
    filter.catch(exception, mockArgumentsHost as ArgumentsHost);
    expect(loggerServiceMock.log).toHaveBeenCalledWith(
      exception.message,
      expect.anything(),
    );
  });

  it('should catch an error with the logger itself', () => {
    const exception = new InternalServerErrorException();
    loggerServiceMock.error = null;
    mockArgumentsHost.getType.mockReturnValue('http');
    console.error = jest.fn();
    filter.catch(exception, mockArgumentsHost as ArgumentsHost);
    expect(console.error).toHaveBeenCalled();
  });
});
