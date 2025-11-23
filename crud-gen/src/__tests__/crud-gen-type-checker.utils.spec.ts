import {
  isCombinedWhereModel,
  isDateFilterModel,
  isFilterInputStrict,
  isFilterModel,
  isFindOperator,
  isMulticolumnJoinOptions,
  isNumberFilterModel,
  isOperator,
  isSetFilterModel,
  isTextFilterModel,
} from '../crud-gen-type-checker.utils.js';
import { FilterType, Operators } from '../crud-gen.enum.js';
import { FilterModel } from '../api-graphql/crud-gen-gql.interface.js';
import {
  fixedCombinedOrDateFilter,
  fixedCombinedOrNumberFilter,
  fixedCombinedOrTextFilter,
  fixedMulticolumnJoinOptionsAndOrObject,
  fixedSetFilter,
  fixedSimpleDateFilter,
  fixedSimpleNumberFilter,
  fixedSimpleTextFilter,
} from '../__mocks__/filter.mocks.js';

describe('Crud-gen type checker', () => {
  it('isFilterModel should works properly', async () => {
    let testData = isFilterModel(undefined);
    expect(testData).toEqual(false);

    testData = isFilterModel(fixedSimpleTextFilter);
    expect(testData).toBeTruthy();
  });

  it('Check isFilterInputStrict works properly', () => {
    const testData = isFilterInputStrict(fixedCombinedOrTextFilter);
    expect(testData).toBeTruthy();
  });

  it('Check isTextFilterModel simple case', async () => {
    const testData = isTextFilterModel(fixedSimpleTextFilter);

    expect(testData).toEqual(true);
  });

  it('Check isTextFilterModel combined case', async () => {
    const testData = isTextFilterModel(fixedCombinedOrTextFilter);

    expect(testData).toEqual(true);
  });

  it('Check isTextFilterModel simple case false', async () => {
    const testData = isTextFilterModel(fixedSimpleNumberFilter);

    expect(testData).toEqual(false);
  });

  it('Check isTextFilterModel combined case false', async () => {
    const testData = isTextFilterModel(fixedCombinedOrNumberFilter);

    expect(testData).toEqual(false);
  });

  it('Check isNumberFilterModel simple case', async () => {
    const testData = isNumberFilterModel(fixedSimpleNumberFilter);

    expect(testData).toEqual(true);
  });

  it('Check isNumberFilterModel combined case', async () => {
    const testData = isNumberFilterModel(fixedCombinedOrNumberFilter);

    expect(testData).toEqual(true);
  });

  it('Check isNumberFilterModel simple case false', async () => {
    const testData = isNumberFilterModel(fixedSimpleDateFilter);

    expect(testData).toEqual(false);
  });

  it('Check isNumberFilterModel combined case false', async () => {
    const testData = isNumberFilterModel(fixedCombinedOrDateFilter);

    expect(testData).toEqual(false);
  });

  it('Check isDateFilterModel simple case', async () => {
    const testData = isDateFilterModel(fixedSimpleDateFilter);

    expect(testData).toEqual(true);
  });

  it('Check isDateFilterModel combined case', async () => {
    const testData = isDateFilterModel(fixedCombinedOrDateFilter);

    expect(testData).toEqual(true);
  });

  it('Check isDateFilterModel simple case false', async () => {
    const testData = isDateFilterModel(fixedSimpleTextFilter);

    expect(testData).toEqual(false);
  });

  it('Check isDateFilterModel combined case false', async () => {
    const testData = isDateFilterModel(fixedCombinedOrTextFilter);

    expect(testData).toEqual(false);
  });

  it('should return false because of missing filters', async () => {
    const isDate = isDateFilterModel(null);
    const isText = isTextFilterModel(null);
    const isNumber = isNumberFilterModel(null);

    expect(isDate).toBeFalsy();
    expect(isText).toBeFalsy();
    expect(isNumber).toBeFalsy();
  });

  it('Check isMulticolumnJoinOptions', () => {
    let testData = isMulticolumnJoinOptions(
      fixedMulticolumnJoinOptionsAndOrObject,
    );
    expect(testData).toEqual(true);

    testData = isMulticolumnJoinOptions(fixedSimpleTextFilter);
    expect(testData).toEqual(false);
  });

  it('should check isFindOperator is working properly', async () => {
    let testData = isFindOperator({});

    expect(testData).toBeFalsy();

    testData = isFindOperator({
      type: FilterType.TEXT,
      value: {},
    } as any);

    expect(testData).toBeTruthy();

    testData = isFindOperator({
      type: FilterType.TEXT,
      child: {},
    } as any);

    expect(testData).toBeTruthy();
  });

  it('Check isOperator', () => {
    let testData = isOperator(
      fixedMulticolumnJoinOptionsAndOrObject.multiColumnJoinOperator,
    );
    expect(testData).toEqual(true);

    testData = isOperator(2);
    expect(testData).toEqual(false);
  });

  it('should check isCombinedWhereModel is working properly', async () => {
    let testData = isCombinedWhereModel({});

    expect(testData).toBeFalsy();

    testData = isCombinedWhereModel({
      operator: Operators.AND,
      filter_1: {},
      filter_2: {},
    } as any);

    expect(testData).toBeTruthy();
  });

  it('Check isSetFilterModel is working properly', () => {
    let testData = isSetFilterModel({} as FilterModel);
    expect(testData).toBeFalsy();

    testData = isSetFilterModel(fixedSetFilter);
    expect(testData).toBeTruthy();
  });
});
