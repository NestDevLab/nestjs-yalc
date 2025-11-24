import {
  describe,
  expect,
  it,
  jest,
  beforeAll,
  beforeEach,
  test,
} from '@jest/globals';
import { PromiseTracker, promiseMap } from '../promise.helper.js';

describe('promise helper test', () => {
  const elements = [1, 2];

  it('It should resolve promises correctly with explicit options', async () => {
    const result = await promiseMap(elements, async (element) => element, {
      concurrency: 10,
      stopOnError: false,
    });

    expect(result).toEqual(elements);
  });

  it('It should resolve promises correctly with implicit options', async () => {
    const result = await promiseMap(elements, async (element) => element);

    expect(result).toEqual(elements);
  });
});

describe('promise tracker test', () => {
  it('It should wait for all promises to resolve', async () => {
    const promiseTracker = new PromiseTracker();

    const promises = [Promise.resolve(1), Promise.resolve(2)];

    promises.forEach((promise) => promiseTracker.add(promise));

    await promiseTracker.waitForAll();

    expect(promiseTracker['promises']).toHaveLength(0);
  });

  it('It should run deferred callbacks after tracked promises', async () => {
    const promiseTracker = new PromiseTracker();
    const calls: string[] = [];

    promiseTracker.add(
      Promise.resolve('ok').then((value) => {
        calls.push(value);
        return value;
      }),
    );

    promiseTracker.addDeferred(() => {
      calls.push('deferred');
    });

    await promiseTracker.waitForAll();

    expect(calls).toEqual(['ok', 'deferred']);
    expect(promiseTracker['promises']).toHaveLength(0);
  });
});
