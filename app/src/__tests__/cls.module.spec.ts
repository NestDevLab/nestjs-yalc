import { describe, expect, it, jest } from '@jest/globals';
import 'reflect-metadata';
import {
  YalcAlsService,
  YalcClsModule,
  YalcGlobalClsService,
} from '../cls.module.js';
import { CLS_MODULE_OPTIONS } from 'nestjs-cls/dist/src/lib/cls.constants.js';

describe('YalcClsModule', () => {
  it('should expose YalcGlobalClsService in module exports', () => {
    const exportedProviders =
      (Reflect.getMetadata('exports', YalcClsModule) as any[]) ?? [];
    expect(exportedProviders).toContain(YalcGlobalClsService);
  });

  it('should expose cls options and execute middleware hooks', async () => {
    const imports =
      (Reflect.getMetadata('imports', YalcClsModule) as any[]) ?? [];
    const clsModuleImport = imports.find((imp) =>
      Array.isArray(imp.providers),
    );
    const optionsProvider = clsModuleImport.providers.find(
      (p: any) => p.provide === CLS_MODULE_OPTIONS,
    );
    const options = optionsProvider.useValue;

    const cls = { set: jest.fn() };
    const req = { headers: { 'X-Request-Id': 'abc' } };

    options.middleware.setup(cls as any, req as any);
    expect(cls.set).toHaveBeenCalledWith('headers', req.headers);

    const idFromHeader = await options.middleware.idGenerator(req as any);
    expect(idFromHeader).toBe('abc');

    const generatedId = await options.middleware.idGenerator({
      headers: {},
    } as any);
    expect(typeof generatedId).toBe('string');
    expect(generatedId.length).toBeGreaterThan(10);
  });

  it('YalcAlsService should persist store within the async context', () => {
    const als = new YalcAlsService();
    const store = { placeholder: 'value' };
    let seen;

    als.run(store, () => {
      seen = als.getStore();
    });

    expect(seen).toEqual(store);
  });
});
