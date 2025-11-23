import { jest } from '@jest/globals';
import { BaseEntity } from 'typeorm';
import { entityFieldsEnumGqlFactory } from '../api-graphql/crud-gen-gql.enum.js';
import * as CrudGenHelper from '../crud-gen.helpers.js';

const fixedProperty = 'columId';

class TestEntity extends BaseEntity {
  [fixedProperty]: number;
}

describe('entityFieldsEnumFactory', () => {
  let mockedGetMappedTypeProperties;
  let fieldsEnum;

  beforeEach(() => {
    mockedGetMappedTypeProperties = jest.spyOn(
      CrudGenHelper,
      'getMappedTypeProperties',
    );

    mockedGetMappedTypeProperties.mockReturnValue([fixedProperty]);
    fieldsEnum = entityFieldsEnumGqlFactory(TestEntity);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return a defined enum fields not cached', () => {
    expect(fieldsEnum).toBeDefined();
    expect(mockedGetMappedTypeProperties).toHaveBeenCalledTimes(1);
    expect(fieldsEnum[fixedProperty]).toBeDefined();
  });

  it('should return a define enum from cache', () => {
    const cachedFildsEnum = entityFieldsEnumGqlFactory(TestEntity);
    expect(mockedGetMappedTypeProperties).toHaveBeenCalledTimes(0);
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
