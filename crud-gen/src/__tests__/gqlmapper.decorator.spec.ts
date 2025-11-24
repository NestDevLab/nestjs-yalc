import { jest } from '@jest/globals';
import { importMockedEsm } from '@nestjs-yalc/jest/esm.helper.js';
import { mockNestJSGraphql } from '@nestjs-yalc/jest';
import {
  mockedExecutionContext,
} from '@nestjs-yalc/jest/common-mocks.helper.js';
import { ModelField, CrudGenObject } from '../object.decorator.js';

await mockNestJSGraphql(import.meta);
const graphql = await import('@nestjs/graphql');
const gqlMapper = await importMockedEsm(
  '../api-graphql/gqlmapper.decorator.js',
  import.meta,
);

@CrudGenObject()
class DummyType {
  @ModelField({ gqlOptions: { name: 'betterName' } })
  dummyProp: string;
}

const stringValue = 'thisIsAString';
const fixedDataObj = { exposed: { dst: stringValue } };
const fixedInfoObj = {
  original: stringValue,
};
describe('Graphql decorator test', () => {
  const mockCreate = (graphql.GqlExecutionContext.create = jest.fn());
  mockCreate.mockImplementation(() => ({
    getArgs: jest.fn().mockReturnValue(fixedInfoObj),
  }));
  it('Check GqlFieldsAsArgsWorker without changing', async () => {
    const testData = gqlMapper.GqlFieldsAsArgsWorker(
      fixedDataObj,
      fixedInfoObj,
    );

    expect(testData).toEqual(fixedInfoObj);
  });
  it('Check GqlFieldsAsArgsWorker with change', async () => {
    const testData = gqlMapper.GqlFieldsAsArgsWorker(fixedDataObj, {
      exposed: stringValue,
    });

    expect(testData).toEqual({ [stringValue]: stringValue });
  });

  it('Check GqlArgsGenerator with data', async () => {
    jest.mocked(gqlMapper.GqlFieldsAsArgsWorker).mockReturnValue(fixedInfoObj);
    const testData = gqlMapper.GqlArgsGenerator(
      { fieldType: DummyType },
      mockedExecutionContext,
    );

    expect(testData).toEqual({ original: 'thisIsAString' });
  });

  it('Check GqlArgsGenerator with data and parameters', async () => {
    jest.mocked(gqlMapper.GqlFieldsAsArgsWorker).mockReturnValue(fixedInfoObj);
    const testData = gqlMapper.GqlArgsGenerator(
      { fieldType: DummyType, _name: 'test', gql: { name: 'test' } },
      mockedExecutionContext,
    );

    expect(testData).toEqual({ original: 'thisIsAString' });
  });

  it('Check GqlArgsGenerator without data', async () => {
    const testData = gqlMapper.GqlArgsGenerator({}, mockedExecutionContext);

    expect(testData).toEqual(fixedInfoObj);
  });

  it('should be able to use the InputArgs to combine param decorators', () => {
    const ArgsFunc = jest.mocked(graphql.Args);
    const returnFunc = jest.fn().mockReturnValue('somestring');
    ArgsFunc.mockReturnValue(returnFunc);
    const decorator = gqlMapper.InputArgs({ fieldMap: {} });
    expect(decorator).toEqual(expect.any(Function));
    decorator('', '', 0);
    expect(returnFunc).toHaveBeenCalled();
  });

  it('should be able to use the InputArgs to combine param decorators with specified params', () => {
    const ArgsFunc = jest.mocked(graphql.Args);
    const returnFunc = jest.fn().mockReturnValue('somestring');
    ArgsFunc.mockReturnValue(returnFunc);
    const decorator = gqlMapper.InputArgs({
      fieldMap: {},
      _name: 'input',
      gql: { name: 'input' },
    });
    expect(decorator).toEqual(expect.any(Function));
    decorator('', '', 0);
    expect(returnFunc).toHaveBeenCalled();
  });

  it('Check GqlArgsGenerator with Obj as arg', async () => {
    const fixedArg = { original: new Object() };
    mockCreate.mockImplementation(() => ({
      getArgs: jest.fn().mockReturnValue(fixedArg),
    }));
    const testData = gqlMapper.GqlArgsGenerator(
      { fieldType: DummyType, _name: 'original', gql: { name: 'original' } },
      mockedExecutionContext,
    );

    expect(testData).toEqual({});
  });
});
