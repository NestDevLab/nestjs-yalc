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
import { createMock } from '@golevelup/ts-jest';
import { LoggerService, UnprocessableEntityException } from '@nestjs/common';

import { ExceptionContextEnum } from '../error.enum.js';
import { SystemExceptionFilter } from '../filters/system-exception.filter.js';

describe('System exceptions filter', () => {
  let filter: SystemExceptionFilter;
  const loggerServiceMock = createMock<LoggerService>();

  beforeAll(() => {
    filter = new SystemExceptionFilter(loggerServiceMock);
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should catch and log UnprocessableEntity error', () => {
    const exception = new UnprocessableEntityException();

    filter.catch(exception);
    expect(loggerServiceMock.error).toHaveBeenCalledWith(
      exception,
      exception.stack,
      ExceptionContextEnum.SYSTEM,
    );
  });
});
