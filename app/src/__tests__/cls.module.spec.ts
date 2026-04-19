import { describe, expect, it, jest } from '@jest/globals';
import 'reflect-metadata';
import {
  YalcAlsService,
  YalcClsModule,
  YalcGlobalClsService,
} from '../cls.module.js';

describe('YalcClsModule', () => {
  it('should expose YalcGlobalClsService in module exports', () => {
    const exportedProviders =
      (Reflect.getMetadata('exports', YalcClsModule) as any[]) ?? [];
    expect(exportedProviders).toContain(YalcGlobalClsService);
  });

  it('should configure a CLS module import', async () => {
    const imports =
      (Reflect.getMetadata('imports', YalcClsModule) as any[]) ?? [];
    expect(imports.length).toBeGreaterThan(0);
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
