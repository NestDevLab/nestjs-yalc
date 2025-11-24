import { describe, expect, it } from '@jest/globals';

const loggerHelper = await import('../logger.helper.js');

const testObject = {
  password: '123',
  foo: 'bar',
  bar: 'foo',
};

describe('test logger helper', () => {
  it('should test the maskDataInObject', () => {
    const subject = loggerHelper.maskDataInObject(testObject);
    expect(subject).toEqual({
      ...testObject,
    });
  });

  it('should attach trace when data is empty', () => {
    const subject = loggerHelper.maskDataInObject(undefined, undefined, 'trace');
    expect(subject).toEqual({ trace: 'trace' });
  });

  it('should test the maskDataInObject with password masking', () => {
    const subject = loggerHelper.maskDataInObject(testObject, ['password']);
    expect(subject).toEqual({
      ...testObject,
      password: '[REDACTED]',
    });
  });

  it('should read logger levels from env', () => {
    process.env.NEST_LOGGER_LEVELS_API = 'error,log';
    process.env.NEST_LOGGER_LEVELS = 'debug';

    expect(loggerHelper.getEnvLoggerLevelsByContext('api')).toEqual([
      'error',
      'log',
    ]);
    expect(loggerHelper.getEnvLoggerLevels('api', ['warn'])).toEqual([
      'error',
      'log',
    ]);

    delete process.env.NEST_LOGGER_LEVELS_API;
    expect(loggerHelper.getEnvLoggerLevels('missing', ['warn'])).toEqual([
      'debug',
    ]);
  });

  it('should wrap string data into object', () => {
    expect(loggerHelper.maskDataInObject('message')).toEqual({ message: 'message' });
  });
});
