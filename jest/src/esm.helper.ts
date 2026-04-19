/**
 * This is a workaround to fix the issue with mocking ESM modules in jest
 * Issue: https://github.com/facebook/jest/issues/13258
 * also @see https://stackoverflow.com/questions/75519950/how-can-i-avoid-a-weird-workaround-when-using-jest-and-esm-together
 *
 * If you hit "Cannot assign to read only property X" while mocking an ESM module,
 * use importMockedEsm in the spec to load a mockable copy before importing the SUT.
 * This helper wraps every function in jest.fn and registers the mock via
 * jest.unstable_mockModule, which avoids the read-only export errors that
 * block normal jest.mock under ESM.
 *
 * Original code:
 * @see https://gist.github.com/booya2nd/dcaa1775fd4c06cd79610e3feea6362c#file-mock-esmodule-js
 */
import * as path from 'path';
import * as url from 'url';
import { jest } from '@jest/globals';

function forEachDeep(
  obj: any,
  cb: {
    ([prop, value]: [any, any], obj: any): void;
    (arg0: any[], arg1: any, arg2: any[]): any;
  },
  options = { depth: 6 },
) {
  (function walk(
    value,
    property: string | undefined = undefined,
    parent = null,
    objPath: any = [],
  ): any {
    return value && typeof value === 'object' && objPath.length <= options.depth
      ? Object.entries(value).forEach(([key, val]) =>
          walk(val, key, value, [...objPath, key]),
        )
      : cb([property, value], parent, objPath);
  })(obj);
}

const NOOP = (x: any) => x;
export async function importMockedEsm(
  moduleSpecifier: any,
  importMeta: { url: string },
  skipActualMock = false,
  factory = NOOP,
) {
  let modulePath = moduleSpecifier;

  if (moduleSpecifier.startsWith('.')) {
    const metaPath = url.fileURLToPath(new URL('./', importMeta.url));
    const thisMetaPath = url.fileURLToPath(new URL('./', import.meta.url));
    const absolutePath = path.join(metaPath, moduleSpecifier);
    modulePath = path.relative(thisMetaPath, absolutePath);
  }

  const module = await import(modulePath);

  const moduleCopy = { ...module };
  forEachDeep(moduleCopy, ([prop, value]: any, obj: { [x: string]: any }) => {
    if (typeof value === 'function') {
      try {
        obj[prop] = jest.fn(value);
      } catch (e) {
        // catch the TypeError: Cannot set property X of [object Object] which has only a getter
        // console.error(e);
      }
      // re-adding stinky dynamic custom properties which jest.fn() may has removed
      Object.assign(obj[prop], value);
    }
  });

  const moduleMock = factory(moduleCopy);

  if (!skipActualMock) jest.unstable_mockModule(modulePath, () => moduleMock);

  return moduleMock;
}
