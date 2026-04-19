import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { importMockedEsm } from '@nestjs-yalc/jest/esm.helper.js';

const loggerHelper = (await importMockedEsm(
  '@nestjs-yalc/logger/logger.helper.js',
  import.meta,
)) as DeepMocked<typeof import('@nestjs-yalc/logger/logger.helper.js')>;

const {
  emitEvent,
  emitFormattedEvent,
  versionedDomainActionFormatter,
  simpleDotFormatter,
  simpleFormatter,
} = await import('../emitter.js'); // replace with your actual module path

describe('Event Emitter', () => {
  let eventEmitter;
  let spiedMaskDataInObject;

  beforeEach(() => {
    eventEmitter = createMock(EventEmitter2);
    jest.mocked(eventEmitter.emit).mockReturnValue(true);
    jest.mocked(eventEmitter.emitAsync).mockResolvedValue([]);
    spiedMaskDataInObject = jest.spyOn(loggerHelper, 'maskDataInObject');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should emit event', async () => {
    const payload = { data: 'test' };
    const name = 'testEvent';
    await emitEvent(eventEmitter, name, payload);
    expect(eventEmitter.emit).toHaveBeenCalledWith(name, payload);
  });

  it('should emit event with mask', async () => {
    const payload = { data: 'test' };
    const name = 'testEvent';
    const mask = ['data'];
    const maskedPayload = { data: '****' };
    jest.mocked(spiedMaskDataInObject).mockReturnValueOnce(maskedPayload);
    await emitEvent(eventEmitter, name, payload, { mask });
    expect(spiedMaskDataInObject).toHaveBeenCalledWith(payload, mask);
    expect(eventEmitter.emit).toHaveBeenCalledWith(name, maskedPayload);
  });

  it('should emit event with formatter', async () => {
    const payload = { data: 'test' };
    const name = ['testEvent'];
    const formattedName = 'formattedTestEvent';
    const formatter = jest.fn().mockReturnValueOnce(formattedName);
    await emitEvent(eventEmitter, name, payload, { formatter });
    expect(formatter).toHaveBeenCalledWith(...name);
    expect(eventEmitter.emit).toHaveBeenCalledWith(formattedName, payload);
  });

  it('should emit formatted event', async () => {
    const payload = { data: 'test' };
    const name = 'TestEvent';
    const formattedName = 'onTestEvent';
    await emitFormattedEvent(eventEmitter, name, payload);
    expect(eventEmitter.emit).toHaveBeenCalledWith(formattedName, payload);
  });

  it('should format versioned domain action', () => {
    const version = 'v1';
    const context = 'context';
    const action = 'action';
    const when = 'when';
    const expected = `${version}.${context}.${action}.${when}`;
    const result = versionedDomainActionFormatter(
      version,
      context,
      action,
      when,
    );
    expect(result).toEqual(expected);
  });

  it('should format versioned domain action (without when)', () => {
    const version = 'v1';
    const context = 'context';
    const action = 'action';
    const expected = `${version}.${context}.${action}.onProcess`;
    const result = versionedDomainActionFormatter(version, context, action);
    expect(result).toEqual(expected);
  });

  it('should format simple dot', () => {
    const args = ['arg1', 'arg2', 'arg3'];
    const expected = args.join('.');
    const result = simpleDotFormatter(...args);
    expect(result).toEqual(expected);
  });

  it('should format simple', () => {
    const action = 'action';
    const expected = `on${action}`;
    const result = simpleFormatter(action);
    expect(result).toEqual(expected);
  });

  it('should emit event asynchronously', async () => {
    const payload = { data: 'test' };
    const name = 'testEvent';
    await emitEvent(eventEmitter, name, payload, { await: true });
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(name, payload);
  });

  it('should emit event synchronously', async () => {
    const payload = { data: 'test' };
    const name = 'testEvent';
    await emitEvent(eventEmitter, name, payload, { await: false });
    expect(eventEmitter.emit).toHaveBeenCalledWith(name, payload);
  });

  it('should emit event synchronously with array name', async () => {
    const payload = { data: 'test' };
    const name = ['testEvent'];
    await emitEvent(eventEmitter, name, payload, { await: false });
    expect(eventEmitter.emit).toHaveBeenCalledWith('testEvent', payload);
  });
});
