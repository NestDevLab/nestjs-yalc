import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { ExecutionContext, CallHandler, NestInterceptor } from '@nestjs/common';
import { of } from 'rxjs';
import { buildSimpleMapperInterceptor } from '../simple-mapper.interceptor.js';

describe('SimpleMapperInterceptor', () => {
  let interceptor: NestInterceptor;

  class TestDto {
    prop1: string;
    prop2: number;

    constructor(data: { prop1: string; prop2: number }) {
      this.prop1 = data.prop1;
      this.prop2 = data.prop2;
    }
  }

  const rawTestObject = { prop1: 'test', prop2: 123 };

  beforeEach(() => {
    interceptor = new (buildSimpleMapperInterceptor(TestDto))();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should map raw data to DTO', (done) => {
    const executionContext = {
      switchToHttp: jest.fn().mockReturnThis(),
      getRequest: jest.fn(),
    } as unknown as ExecutionContext;

    const next: CallHandler = {
      handle: () => of(rawTestObject),
    };

    interceptor.intercept(executionContext, next).subscribe((result) => {
      expect(result).toBeInstanceOf(TestDto);
      expect(result).toMatchObject(rawTestObject);
      done();
    });
  });

  it('should map arrays with transformer and callback', (done) => {
    const transformer = jest.fn((data: any) =>
      data.map((item: any) => ({ ...item, prop2: item.prop2 + 1 })),
    );
    const callback = jest.fn((input: any, output: any) => ({
      input,
      output,
    }));
    const ArrayInterceptor = buildSimpleMapperInterceptor(TestDto, {
      transformer,
      callback,
    });
    interceptor = new ArrayInterceptor();

    const executionContext = {
      switchToHttp: jest.fn().mockReturnThis(),
      getRequest: jest.fn(),
    } as unknown as ExecutionContext;

    const next: CallHandler = {
      handle: () =>
        of([
          rawTestObject,
          { prop1: 'second', prop2: 321 },
        ] as { prop1: string; prop2: number }[]),
    };

    interceptor.intercept(executionContext, next).subscribe((result) => {
      expect(transformer).toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
      expect(result.input).toHaveLength(2);
      expect(result.output[0]).toBeInstanceOf(TestDto);
      expect(result.output[0]).toMatchObject({ prop1: 'test', prop2: 124 });
      done();
    });
  });
});
