import { jest } from '@jest/globals';
import {
  agJoinArgFactory,
  filterExpressionInputFactory,
  RowGroup,
  SortModel,
  sortModelFactory,
} from '../api-graphql/crud-gen.input.js';
import * as CrudGenEnum from '../crud-gen.enum.js';
import * as CrudGenHelpers from '../crud-gen.helpers.js';
import { TestEntity, TestEntityRelation } from '../__mocks__/entity.mock.js';
jest.mock('../api-graphql/crud-gen-gql.enum.js', () => {
  const actual = jest.requireActual('../api-graphql/crud-gen-gql.enum.js');
  return {
    ...actual,
    entityFieldsEnumFactory: jest.fn(() => ({
      enum: { test: 'test' },
      cached: false,
      prototype: { name: 'Test' },
    })),
  };
});
jest.mock('../api-graphql/crud-gen-gql.enum.js', () => {
  const actual = jest.requireActual('../api-graphql/crud-gen-gql.enum.js');
  return {
    ...actual,
    entityFieldsEnumFactory: jest.fn(() => ({
      enum: { test: 'test' },
      cached: false,
      prototype: { name: 'Test' },
    })),
  };
});

describe('Dynamic user input dto test', () => {
  const spiedEntityFieldsEnumFactory = jest.spyOn(
    CrudGenEnum,
    'entityFieldsEnumFactory',
  );

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
      spiedEntityFieldsEnumFactory.mockReturnValue({
        ['test']: 'test',
      });
    });

    afterEach(() => {
      spiedEntityFieldsEnumFactory.mockReset();
    });

    it('Should return a SortModel correctly not cached', () => {
      const result = sortModelFactory<TestEntity>(TestEntity);
      expect(result).toBeDefined();
      expect(spiedEntityFieldsEnumFactory).toHaveBeenCalledTimes(1);
      spiedEntityFieldsEnumFactory.mockReset();
    });

    it('Should return a SortModel correctly cached', () => {
      const result = sortModelFactory<TestEntity>(TestEntity);
      expect(result).toBeDefined();
      expect(spiedEntityFieldsEnumFactory).toHaveBeenCalledTimes(0);
    });
  });

  describe('Check FilterExpressionInputFactory', () => {
    beforeEach(() => {
      spiedEntityFieldsEnumFactory.mockReturnValue({
        ['test']: 'test',
      });
    });

    afterEach(() => {
      spiedEntityFieldsEnumFactory.mockReset();
    });

    it('Should return a FilterExpression correctly not cached', () => {
      const result = filterExpressionInputFactory<TestEntity>(TestEntity);
      expect(result).toBeDefined();
      expect(spiedEntityFieldsEnumFactory).toHaveBeenCalledTimes(1);
      spiedEntityFieldsEnumFactory.mockReset();
    });

    it('Should return a FilterExpression correctly cached', () => {
      const result = filterExpressionInputFactory<TestEntity>(TestEntity);
      expect(result).toBeDefined();
      expect(spiedEntityFieldsEnumFactory).toHaveBeenCalledTimes(0);
    });
  });

  it('Should return the JoinOptionInput already cached', () => {
    const spiedgetEntityRelations = jest.spyOn(
      CrudGenHelpers,
      'getEntityRelations',
    );
    const result = agJoinArgFactory(TestEntityRelation);
    expect(result).toBeDefined();

    const cachedResult = agJoinArgFactory(TestEntityRelation);
    expect(cachedResult).toBe(result);
    expect(spiedgetEntityRelations).toHaveBeenCalledTimes(1);
  });
});
