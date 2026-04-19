/* istanbul ignore file */
import { expect, jest, describe, it } from '@jest/globals';

import { FactoryType } from '@nestjs-yalc/interfaces/common.type.js';
import { faker } from '@faker-js/faker';
import { getTestFilenameWithoutExtension } from './helpers.js';
import { ClassType } from '@nestjs-yalc/types/globals.d.js';

export function classesAreDefinedTest(
  moduleName: string,
  classList: ClassType[],
) {
  describe(`${getTestFilenameWithoutExtension(
    moduleName,
  )} classes test`, () => {
    for (const aClass of classList) {
      it(`should be able to create ${aClass.name} class instance`, () => {
        const testData = new aClass();
        expect(testData).toBeInstanceOf(aClass);
      });
    }
  });
}

export function factoriesAreDefinedTest(
  moduleName: string,
  factoryList: FactoryType[],
) {
  describe(`${getTestFilenameWithoutExtension(
    moduleName,
  )} factories test`, () => {
    it(`All the factories should be defined`, () => {
      for (const aFactory of factoryList) {
        let instance = aFactory(faker);
        expect(instance).toBeDefined();

        jest.spyOn(faker.number, 'int').mockReturnValue(0 as never);
        jest.spyOn(faker.datatype, 'boolean').mockReturnValue(false);
        instance = aFactory(faker);
        expect(instance).toBeDefined();

        jest.spyOn(faker.number, 'int').mockReturnValue(1 as never);
        jest.spyOn(faker.datatype, 'boolean').mockReturnValue(true);
        instance = aFactory(faker);
        expect(instance).toBeDefined();

        jest.spyOn(faker.number, 'int').mockRestore();
        jest.spyOn(faker.datatype, 'boolean').mockRestore();
      }
    });
  });
}
