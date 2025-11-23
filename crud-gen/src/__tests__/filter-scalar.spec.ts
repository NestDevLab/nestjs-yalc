import { ObjectValueNode, StringValueNode } from 'graphql';
import {
  FilterType,
  GeneralFilters,
  Operators,
} from '../crud-gen.enum.js';
import {
  FilterInput,
  IMultiColumnJoinOptions,
} from '../api-graphql/crud-gen-gql.interface.js';
import { FilterScalar } from '../filter.scalar.js';
import { fixedSimpleTextFilter } from '../__mocks__/filter.mocks.js';

const createdFilterScalar = new FilterScalar();
const fixedString =
  '{"ID":{"filterType":"text","type":"contains","filter":"_"}}';
const fixedObj: FilterInput = {
  expressions: [
    {
      [FilterType.TEXT]: {
        type: GeneralFilters.CONTAINS,
        filterType: FilterType.TEXT,
        field: 'ID',
        filter: '_',
      },
    },
  ],
};
const objectValueNode: ObjectValueNode = {
  kind: 'ObjectValue',
  fields: [],
};
const stringValueNode: StringValueNode = {
  kind: 'StringValue',
  value: '{"ID":{"filterType":"text","type":"contains","filter":"_"}}',
};

const fixedMultiColumnObject: IMultiColumnJoinOptions = {
  multiColumnJoinOperator: Operators.AND,
  ['fixedKey']: fixedSimpleTextFilter,
  multiColumnJoinOptions: {
    multiColumnJoinOperator: Operators.OR,
    ['fixedKey']: fixedSimpleTextFilter,
  },
};
describe('Filter scalar', () => {
  it('Check parsevalue functionality', async () => {
    const testData = createdFilterScalar.parseValue(fixedString);
    expect(testData).toStrictEqual(fixedObj);
    expect(createdFilterScalar.resultMemoizeInverse.has(testData)).toBeTruthy();
  });
  it('Check serialize functionality', async () => {
    const filter = createdFilterScalar.parseValue(fixedString);

    let testData = createdFilterScalar.serialize(filter);
    expect(testData).toEqual(fixedString);

    testData = createdFilterScalar.serialize(fixedString);
    expect(fixedString).toEqual(fixedString);
  });
  it('Check parseLiteral functionality', async () => {
    const testData = createdFilterScalar.parseLiteral(stringValueNode);
    expect(testData).toEqual(fixedObj);
  });
  it('Check parseLiteral error', async () => {
    expect(() =>
      createdFilterScalar.parseLiteral(objectValueNode),
    ).toThrowError();
  });

  it('test it test it', () => {
    const testData = createdFilterScalar.parseValue(
      JSON.stringify(fixedMultiColumnObject),
    );
    expect(testData.expressions).toBeDefined();
    expect(testData.childExpressions).toBeDefined();
  });
});
