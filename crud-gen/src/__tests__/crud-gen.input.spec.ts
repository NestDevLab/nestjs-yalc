import { jest } from '@jest/globals';
import { importMockedEsm } from '@nestjs-yalc/jest/esm.helper.js';

const spiedEntityFieldsEnumGqlFactory = jest.fn(() => ({
  test: 'test',
}));

await jest.unstable_mockModule('../api-graphql/crud-gen-gql.enum.js', () => ({
  __esModule: true,
  entityFieldsEnumFactory: jest.fn(),
  entityFieldsEnumGqlFactory: spiedEntityFieldsEnumGqlFactory,
}));

const CrudGenHelpers = await importMockedEsm(
  '../crud-gen.helpers.js',
  import.meta,
);
const spiedGetEntityRelations = jest.spyOn(
  CrudGenHelpers,
  'getEntityRelations',
);
const {
  agJoinArgFactory,
  filterExpressionInputFactory,
  RowGroup,
  SortModel,
  sortModelFactory,
} = await import('../api-graphql/crud-gen.input.js');
import * as CrudGenEnum from '../crud-gen.enum.js';
import { TestEntity, TestEntityRelation } from '../__mocks__/entity.mock.js';

describe('Dynamic user input dto test', () => {
  it('Check RowGroup Dto', async () => {
    const testData = new RowGroup();

    expect(testData).toBeDefined();
  });
  it('Check SortModel Dto', async () => {
    const testData = new SortModel();

    expect(testData).toBeDefined();
  });

  describe('Check SortModelFactory', () => {
    beforeEach(() => {
      spiedEntityFieldsEnumGqlFactory.mockReturnValue({
        ['test']: 'test',
      });
    });

    afterEach(() => {
      spiedEntityFieldsEnumGqlFactory.mockReset();
    });

    it('Should return a SortModel correctly not cached', () => {
      const result = sortModelFactory<TestEntity>(TestEntity);
      expect(result).toBeDefined();
      expect(spiedEntityFieldsEnumGqlFactory).toHaveBeenCalledTimes(1);
      spiedEntityFieldsEnumGqlFactory.mockReset();
    });

    it('Should return a SortModel correctly cached', () => {
      const result = sortModelFactory<TestEntity>(TestEntity);
      expect(result).toBeDefined();
      expect(spiedEntityFieldsEnumGqlFactory).toHaveBeenCalledTimes(0);
    });
  });

  describe('Check FilterExpressionInputFactory', () => {
    beforeEach(() => {
      spiedEntityFieldsEnumGqlFactory.mockReturnValue({
        ['test']: 'test',
      });
    });

    afterEach(() => {
      spiedEntityFieldsEnumGqlFactory.mockReset();
    });

    it('Should return a FilterExpression correctly not cached', () => {
      const result = filterExpressionInputFactory<TestEntity>(TestEntity);
      expect(result).toBeDefined();
      expect(spiedEntityFieldsEnumGqlFactory).toHaveBeenCalledTimes(1);
      spiedEntityFieldsEnumGqlFactory.mockReset();
    });

    it('Should return a FilterExpression correctly cached', () => {
      const result = filterExpressionInputFactory<TestEntity>(TestEntity);
      expect(result).toBeDefined();
      expect(spiedEntityFieldsEnumGqlFactory).toHaveBeenCalledTimes(0);
    });
  });

  it('Should return the JoinOptionInput already cached', () => {
    const result = agJoinArgFactory(TestEntityRelation);
    expect(result).toBeDefined();

    const cachedResult = agJoinArgFactory(TestEntityRelation);
    expect(cachedResult).toBe(result);
  });
});
