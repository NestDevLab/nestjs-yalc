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

// class NestLogger {}

// jest.mock('@nestjs/common', () => ({
//   ...(jest.requireActual('@nestjs/common') as any),
//   Logger: NestLogger,
// }));

// import { LogLevelEnum, LoggerTypeEnum } from '../logger.enum.js';
// import { AppLoggerFactory } from '../logger.factory.js';
// import { DeepMocked } from '@golevelup/ts-jest';
import { createMock } from '@golevelup/ts-jest';
import { LoggerService } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TypeORMLogger } from '../typeorm-logger.js';

describe('TypeORMLogger with a valid logger', () => {
  const mockedLoggerService = createMock<LoggerService>();
  const mockedEventEmitter2 = createMock<EventEmitter2>();
  let testLogger: TypeORMLogger;

  beforeAll(() => {
    process.env.TYPEORM_LOGGING = 'true';
    testLogger = new TypeORMLogger(mockedLoggerService, mockedEventEmitter2);
  });

  afterAll(() => {
    delete process.env.TYPEORM_LOGGING;
  });

  it('logQuery ', async () => {
    const spiedLoggerServiceFn = jest.spyOn(mockedLoggerService, 'debug');
    testLogger.logQuery('aQuery');
    expect(spiedLoggerServiceFn).toHaveBeenCalledTimes(1);
  });

  it('logQueryError ', async () => {
    const spiedLoggerServiceFn = jest.spyOn(mockedLoggerService, 'error');
    testLogger.logQueryError('error', 'aQuery');
    expect(spiedLoggerServiceFn).toHaveBeenCalledTimes(1);
  });

  it('logQuerySlow ', async () => {
    const spiedLoggerServiceFn = jest.spyOn(mockedLoggerService, 'warn');
    testLogger.logQuerySlow(10000, 'aQuery');
    expect(spiedLoggerServiceFn).toHaveBeenCalledTimes(1);
  });

  it('logSchemaBuild ', async () => {
    const spiedLoggerServiceFn = jest.spyOn(mockedLoggerService, 'debug');
    testLogger.logSchemaBuild('aQuery');
    expect(spiedLoggerServiceFn).toHaveBeenCalledTimes(2);
  });

  it('logMigration ', async () => {
    const spiedLoggerServiceFn = jest.spyOn(mockedLoggerService, 'debug');
    testLogger.logMigration('aQuery');
    expect(spiedLoggerServiceFn).toHaveBeenCalledTimes(3);
  });

  it('log ', async () => {
    const spiedLoggerServiceLog = jest.spyOn(mockedLoggerService, 'log');
    testLogger.log('log', 'aQuery');
    expect(spiedLoggerServiceLog).toHaveBeenCalledTimes(1);

    const spiedLoggerServiceInfo = jest.spyOn(mockedLoggerService, 'verbose');
    testLogger.log('info', 'aQuery');
    expect(spiedLoggerServiceInfo).toHaveBeenCalledTimes(1);

    const spiedLoggerServiceWarn = jest.spyOn(mockedLoggerService, 'warn');
    testLogger.log('warn', 'aQuery');
    expect(spiedLoggerServiceWarn).toHaveBeenCalledTimes(2);
  });
});

describe('TypeORMLogger with a invalid logger', () => {
  const mockedLoggerService = createMock<LoggerService>();
  const mockedEventEmitter2 = createMock<EventEmitter2>();
  mockedLoggerService.debug = undefined;
  mockedLoggerService.error = undefined;
  mockedLoggerService.warn = undefined;
  mockedLoggerService.log = undefined;
  mockedLoggerService.verbose = undefined;
  const testLogger = new TypeORMLogger(
    mockedLoggerService,
    mockedEventEmitter2,
  );

  it('All che level should ignore a missing logger function ', async () => {
    expect(() => testLogger.logQuery('aQuery')).not.toThrow();
    expect(() =>
      testLogger.logQueryError('error', 'aQuery'),
    ).not.toThrow();
    expect(() => testLogger.logQuerySlow(10000, 'aQuery')).not.toThrow();
    expect(() => testLogger.logSchemaBuild('aQuery')).not.toThrow();
    expect(() => testLogger.logMigration('aQuery')).not.toThrow();
    expect(() => testLogger.log('log', 'aQuery')).not.toThrow();
    expect(() => testLogger.log('info', 'aQuery')).not.toThrow();
    expect(() => testLogger.log('warn', 'aQuery')).not.toThrow();
  });
});
