import { AnyFunction } from '@nestjs-yalc/types/globals.d.js';
import * as pMap from 'p-map';

export const PROMISE_CONCURRENCY_LIMIT = 1000;

/**
 * This method allows you to run multiple async functions concurrently. It's an alternative to the Promise.all native method
 * with support to concurrency limit. It's an adapter of the p-map library.
 * NOTE: concurrency is set to 1000 by default and stopOnError = true
 * 
@param input - Iterated over concurrently in the `mapper` function.
@param mapper - Function which is called for every item in `input`. Expected to return a `Promise` or value.
@returns A `Promise` that is fulfilled when all promises in `input` and ones returned from `mapper` are fulfilled, or rejects if any of the promises reject. The fulfilled value is an `Array` of the fulfilled values returned from `mapper` in `input` order.
*/
export function promiseMap<Element, NewElement>(
  input: Iterable<Element>,
  mapper: pMap.Mapper<Element, NewElement>,
  options?: pMap.Options,
): Promise<NewElement[]> {
  return pMap.default(input, mapper, {
    concurrency: options?.concurrency ?? PROMISE_CONCURRENCY_LIMIT,
    stopOnError: options?.stopOnError ?? true,
  });
}

/**
 * This class allows you to track multiple promises and wait for all of them to resolve.
 */
export class PromiseTracker {
  private promises: Promise<any>[] = [];
  private deferred: AnyFunction[] = [];

  add(promise: Promise<any>) {
    this.promises.push(promise);
    void promise
      .finally(() => this.remove(promise))
      .catch(() => {
        // The original promise is still awaited by callers; this only prevents
        // the cleanup chain from surfacing a duplicate unhandled rejection.
      });
  }

  /**
   * @param deferred - A function that will be executed after all promises are resolved.
   */
  addDeferred(deferred: AnyFunction) {
    this.deferred.push(deferred);
  }

  private remove(promise: Promise<any>) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.promises = this.promises.filter((p) => p !== promise);
  }

  async waitForAll() {
    await Promise.all(this.promises);

    await Promise.all(this.deferred.map((d) => d()));
  }
}

/**
 * This is a global instance of the PromiseTracker class.
 */
export const globalPromiseTracker = new PromiseTracker();
