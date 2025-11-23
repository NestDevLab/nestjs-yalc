import {
  FilterType,
  GeneralFilters,
  Operators,
} from '../crud-gen.enum.js';
import {
  DateFilterModel,
  FilterModel,
  ISimpleFilterModel,
  ITextFilterModel,
  INumberFilterModel,
  ICombinedSimpleModel,
  FilterInput,
} from '../api-graphql/crud-gen-gql.interface.js';
import { fixedSimpleTextFilter } from '../__mocks__/filter.mocks.js';

const simpleFilterModel: ISimpleFilterModel = {
  filterType: FilterType.TEXT,
  type: GeneralFilters.EQUALS,
  field: 'test',
};
describe('Assets input dto test', () => {
  it('Check ISimpleFilterModel ', async () => {
    const testData: ISimpleFilterModel = simpleFilterModel;
    expect(testData).toBeDefined();
  });
  it('Check DateFilterModel', async () => {
    const testData: DateFilterModel = {
      filterType: FilterType.DATE,
      field: 'test',
      type: GeneralFilters.EQUALS,
    };
    expect(testData).toBeDefined();
  });
  it('Check ITextFilterModel', async () => {
    const testData: ITextFilterModel = {
      filterType: FilterType.TEXT,
      field: 'test',
      type: GeneralFilters.EQUALS,
    };
    expect(testData).toBeDefined();
  });
  it('Check FilterModel', async () => {
    const testData: FilterModel = {
      filterType: FilterType.TEXT,
      field: 'test',
      type: GeneralFilters.EQUALS,
    };
    expect(testData).toBeDefined();
  });
  it('Check NumberFilterModel', async () => {
    const testData: INumberFilterModel = {
      filterType: FilterType.NUMBER,
      field: 'test',
      type: GeneralFilters.EQUALS,
    };
    expect(testData).toBeDefined();
  });
  it('Check ICombinedSimpleModel', async () => {
    const testData: ICombinedSimpleModel = {
      filterType: FilterType.NUMBER,
      operator: Operators.AND,
      condition1: simpleFilterModel,
      condition2: simpleFilterModel,
    };
    expect(testData).toBeDefined();
  });
  it('Check FilterInput', async () => {
    const testData: FilterInput = {
      expressions: [
        {
          text: fixedSimpleTextFilter,
        },
      ],
      operator: Operators.AND,
    };
    expect(testData).toBeDefined();
  });
});
