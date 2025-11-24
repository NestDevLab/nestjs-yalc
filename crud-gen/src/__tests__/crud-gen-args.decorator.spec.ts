import { jest } from '@jest/globals';
import { importMockedEsm } from '@nestjs-yalc/jest/esm.helper.js';
import { mockNestJSGraphql } from '@nestjs-yalc/jest';
import { createMock } from '@golevelup/ts-jest';
import { BaseEntity, Equal } from 'typeorm';
import { GeneralFilters, ExtraArgsStrategy, FilterType } from '../crud-gen.enum.js';

await mockNestJSGraphql(import.meta);
const graphql = await import('@nestjs/graphql');

const gqlFieldsMapperMock = jest.fn().mockReturnValue({
  keys: ['field'],
  keysMeta: { field: {} },
  extraInfo: {},
});

await jest.unstable_mockModule('../api-graphql/gqlfields.decorator.js', () => ({
  __esModule: true,
  GqlModelFieldsMapper: gqlFieldsMapperMock,
}));

const CrudGenHelpers = await importMockedEsm(
  '../crud-gen.helpers.js',
  import.meta,
);
const CrudGenInput = await importMockedEsm(
  '../api-graphql/crud-gen.input.js',
  import.meta,
);

const crudGenArgsDecorator = await import(
  '../api-graphql/crud-gen-args-gql.decorator.js'
);

const infoObj = {
  fieldNodes: [
    {
      selectionSet: {
        selections: [{ name: { value: 'field' } }],
      },
    },
  ],
} as any;

const fixedArgsOptions = {
  entityType: BaseEntity,
  options: { maxRow: 200 },
} as any;

const fixedArgsQueryParams = { filters: {}, startRow: 0, endRow: 5 };

const mockedInfo = createMock<any>();
const mockCreate = (graphql.GqlExecutionContext.create = jest.fn());
mockCreate.mockImplementation(() => ({
  getArgs: jest.fn().mockReturnValue(fixedArgsQueryParams),
  getInfo: jest.fn().mockReturnValue(infoObj),
}));

describe('Crud-gen args decorator (esm-safe)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    gqlFieldsMapperMock.mockReturnValue({
      keys: ['field'],
      keysMeta: { field: {} },
      extraInfo: {},
    });
    jest
      .mocked(CrudGenHelpers.objectToFieldMapper)
      .mockReturnValue({ field: {}, filterOption: {} } as any);
  });

  it('mapCrudGenParams handles basic filters', () => {
    const result = crudGenArgsDecorator.mapCrudGenParams(
      fixedArgsOptions,
      createMock(),
      fixedArgsQueryParams,
      mockedInfo,
    );
    expect(result).toBeDefined();
  });

  it('convertFilter returns operator for simple set', () => {
    const filter = {
      filterType: FilterType.SET,
      values: ['a'],
      conditionType: 'OR',
    } as any;
    expect(() => crudGenArgsDecorator.convertFilter(filter)).not.toThrow();
  });

  it('createWhere handles null input', () => {
    const result = crudGenArgsDecorator.createWhere(null as any, {}, '');
    expect(result).toEqual({ filters: {} });
  });

  it('getFindOperator works for text', () => {
    const op = crudGenArgsDecorator.getFindOperator(
      FilterType.TEXT,
      GeneralFilters.EQUALS,
      'a',
    );
    expect(op).toEqual(Equal('a'));
  });

  it('CrudGenCombineDecorators creates decorator', () => {
    const argsFn = jest.spyOn(graphql, 'Args');
    argsFn.mockReturnValue(jest.fn());
    jest.mocked(CrudGenInput.agJoinArgFactory).mockReturnValue({});
    const decorator = crudGenArgsDecorator.CrudGenCombineDecorators(
      fixedArgsOptions,
    );
    expect(decorator).toEqual(expect.any(Function));
  });

  it('checkFilterScope throws on prohibited filter', () => {
    expect(() =>
      crudGenArgsDecorator.checkFilterScope(
        { filters: { forbidden: {} } } as any,
        { type: 'EXCLUDE', fields: ['forbidden'] } as any,
      ),
    ).toThrow();
  });

  it('mapCrudGenParams respects extra args strategy', () => {
    const params = {
      ...fixedArgsOptions,
      extraArgsStrategy: ExtraArgsStrategy.AT_LEAST_ONE,
      extraArgs: {
        foo: {
          filterType: FilterType.TEXT,
          filterCondition: GeneralFilters.EQUALS,
          options: { defaultValue: 'bar' },
        },
      },
    } as any;
    expect(() =>
      crudGenArgsDecorator.mapCrudGenParams(
        params,
        createMock(),
        fixedArgsQueryParams,
        mockedInfo,
      ),
    ).toThrow();
  });
});
