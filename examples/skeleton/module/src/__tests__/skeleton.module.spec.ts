import { expect, jest, describe, it } from '@jest/globals';

import 'reflect-metadata';
import { mockNestJSGraphql } from '@nestjs-yalc/jest';
import { importMockedEsm } from '@nestjs-yalc/jest/esm.helper.js';

await mockNestJSGraphql(import.meta);

const helpers = await importMockedEsm(
  '@nestjs-yalc/crud-gen/crud-gen.helpers.js',
  import.meta,
);

const { SkeletonModule } = await import('../index.js');

describe('Test skeleton module', () => {
  it('should register the module', () => {
    const spiedCrudGenDependencyFactory = jest.spyOn(
      helpers,
      'CrudGenDependencyFactory',
    );

    const module = SkeletonModule.register('test');
    expect(module).toBeDefined();
    expect(spiedCrudGenDependencyFactory).toHaveBeenCalledTimes(2); // user and phone
  });
});
