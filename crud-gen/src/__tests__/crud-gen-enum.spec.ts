import { jest } from '@jest/globals';
import { importMockedEsm } from '@nestjs-yalc/jest/esm.helper.js';
import { BaseEntity } from 'typeorm';

const CrudGenHelper = await importMockedEsm(
  '../crud-gen.helpers.js',
  import.meta,
);

const { entityFieldsEnumGqlFactory } = await import(
  '../api-graphql/crud-gen-gql.enum.js'
);

const fixedProperty = 'columId';

describe('entityFieldsEnumFactory', () => {
  let mockedGetMappedTypeProperties: jest.SpyInstance;
  let fieldsEnum;
  let EntityModel: any;

  beforeEach(() => {
    mockedGetMappedTypeProperties = jest.spyOn(
      CrudGenHelper,
      'getMappedTypeProperties',
    );

    EntityModel = class extends BaseEntity {
      [fixedProperty]: number;
    };

    mockedGetMappedTypeProperties.mockReturnValue([fixedProperty]);
    fieldsEnum = entityFieldsEnumGqlFactory(EntityModel);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return a defined enum fields not cached', () => {
    expect(fieldsEnum).toBeDefined();
  });

  it('should return a define enum from cache', () => {
    const cachedFildsEnum = entityFieldsEnumGqlFactory(EntityModel);
    expect(cachedFildsEnum).toStrictEqual(fieldsEnum);
  });

  it('should work with entityModel as a function', () => {
    function objectFunction() {
      this.value = 'value';
    }
    const result = entityFieldsEnumGqlFactory(objectFunction);
    expect(result).toBeDefined();
  });
});
