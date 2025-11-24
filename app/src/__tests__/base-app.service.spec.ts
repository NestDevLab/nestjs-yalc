import { describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext, LoggerService } from '@nestjs/common';
import { BaseAppService } from '../base-app.service.js';

describe('BaseAppService', () => {
  const logger: LoggerService = {
    debug: jest.fn(),
  };
  const service = new BaseAppService(logger);

  it('should format hello message with app name', () => {
    expect(service.getHello('test-app')).toBe('Hello World from test-app!');
  });

  it('should log handler names containing underscore and not starting with "_"', () => {
    const ctx = {
      getHandler: () => ({ name: 'test_handler' }),
    } as unknown as ExecutionContext;

    service.handleBeforeAllRoutes(ctx);

    expect(logger.debug).toHaveBeenCalledWith('Running Handler: test_handler');
  });

  it('should ignore handlers without underscore or starting with "_"', () => {
    (logger.debug as jest.Mock).mockClear();
    const ctxWithoutUnderscore = {
      getHandler: () => ({ name: 'handler' }),
    } as unknown as ExecutionContext;
    const ctxInternal = {
      getHandler: () => ({ name: '_internal_handler' }),
    } as unknown as ExecutionContext;

    service.handleBeforeAllRoutes(ctxWithoutUnderscore);
    service.handleBeforeAllRoutes(ctxInternal);

    expect(logger.debug).not.toHaveBeenCalled();
  });
});
