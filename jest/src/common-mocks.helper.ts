/* istanbul ignore file */

import { jest } from '@jest/globals';
import { createRequire } from 'module';

// Works in both CJS and ESM test runs
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dynamicRequire: NodeRequire =
  typeof require === 'function'
    ? require
    : createRequire(
        typeof import.meta !== 'undefined' && (import.meta as any).url
          ? (import.meta as any).url
          : new URL('./', `file://${process.cwd()}/`).href,
      );

let NestGraphql: any;

try {
  jest.mock('@nestjs/graphql');
  NestGraphql = dynamicRequire('@nestjs/graphql');
} catch (e) {
  // ignore error
}

import { ExecutionContext } from '@nestjs/common';
import {
  createMock,
  DeepMocked,
  MockOptions,
  PartialFuncReturn,
} from '@golevelup/ts-jest';
import { SelectQueryBuilder } from 'typeorm';

export const mockedNestGraphql = () => {
  return NestGraphql as jest.Mocked<typeof NestGraphql>;
};
export const mockedGqlCtxCreate = () => {
  return (mockedNestGraphql().GqlExecutionContext.create = jest.fn());
};

export const mockedExecutionContext = createMock<ExecutionContext>();

/**
 * This method can be used to DeepMock a chained object where all methods return
 * its instance
 *
 * @returns DeepMocked object with all methods returning "this" by default
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export const mockChainingObject = <T extends object>(
  partial?: PartialFuncReturn<T>,
  options?: MockOptions,
): DeepMocked<T> => {
  const mockObject = createMock<T>(partial, options);

  const propsToOverride = new Map();

  const proxy: DeepMocked<T> = new Proxy(mockObject, {
    get: function (target, prop, receiver) {
      const checkProp = target[<keyof T>prop] as any;

      // do not replace implementation of user defined methods
      if (propsToOverride.has(prop) || (partial && prop in partial)) {
        return Reflect.get(target, prop, receiver);
      }

      return typeof checkProp === 'function'
        ? checkProp.mockImplementation(() => {
            Reflect.get(target, prop, receiver);
            return proxy; // return this proxy instead of the method result
          })
        : Reflect.get(target, prop, receiver);
    },
    set: function (target, property, value, receiver) {
      propsToOverride.set(property, value);
      return Reflect.set(target, property, value, receiver);
    },
  });

  return proxy;
};

/**
 * Similar to mockChainingObject but includes some specific case for
 * the typeorm QueryBuilder
 * @returns DeepMocked querybuilder instance
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export const mockQueryBuilder = <T extends object>(
  partial?: PartialFuncReturn<SelectQueryBuilder<T>>,
  options?: MockOptions,
): DeepMocked<SelectQueryBuilder<T>> => {
  const mockObject = mockChainingObject<SelectQueryBuilder<T>>(
    partial,
    options,
  );

  mockObject.connection.createQueryBuilder = jest
    .fn()
    .mockReturnValue(mockObject) as any;

  return mockObject;
};
