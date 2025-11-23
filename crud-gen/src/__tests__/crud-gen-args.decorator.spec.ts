import { jest } from '@jest/globals';

jest.mock('@nestjs/graphql', () => {
  const actual = jest.requireActual('@nestjs/graphql');
  return {
    ...actual,
    Args: jest.fn((...params) => actual.Args(...params)),
    GqlExecutionContext: {
      ...actual.GqlExecutionContext,
      create: jest.fn(),
    },
  };
});
jest.mock('../crud-gen.args.js', () => ({
  crudGenParamsFactory: jest.fn(),
  crudGenParamsNoPaginationFactory: jest.fn(),
}));

import * as crudGenArgsDecorator from '../api-graphql/crud-gen-args-gql.decorator.js';
import {
  Equal,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Like,
  Between,
  In,
  BaseEntity,
} from 'typeorm';
import { ICrudGenParams } from '../crud-gen.args.js';
import {
  ExtraArgsStrategy,
  FilterType,
  GeneralFilters,
} from '../crud-gen.enum.js';
import { GqlExecutionContext } from '@nestjs/graphql';
import {
  mockedExecutionContext,
  mockedNestGraphql,
} from '@nestjs-yalc/jest/common-mocks.helper.js';
import {
  FilterInput,
  FilterModel,
  ICrudGenGqlArgsOptions,
  ICombinedSimpleModel,
} from '../api-graphql/crud-gen-gql.interface.js';
import * as graphql from '@nestjs/graphql';
import * as CrudGenInput from '../api-graphql/crud-gen.input.js';
import * as GqlCrudGenDecorator from '../api-graphql/gqlfields.decorator.js';
import * as CrudGenHelpers from '../crud-gen.helpers.js';
import {
  CrudGenFilterNotSupportedError,
  CrudGenFilterProhibited,
  CrudGenInvalidArgumentError,
  CrudGenInvalidOperatorError,
  CrudGenError,
} from '../crud-gen.error.js';
import { DateHelper } from '@nestjs-yalc/utils/date.helper.js';
import { GraphQLResolveInfo } from 'graphql';
import { createMock } from '@golevelup/ts-jest';
import {
  fixedArgsNoFilters,
  fixedArgsNOTFilter,
  fixedArgsOptions,
  fixedArgsQueryParams,
  fixeDatedArgs,
  fixedBadArgs,
  fixedCombinedAndTextFilter,
  fixedCombinedInvalidArgsTextFilter,
  fixedCombinedInvalidOperatorTextFilter,
  fixedCombinedOrTextFilter,
  fixedDataWithDefault,
  fixedExcludefilterOption,
  fixedIFieldMapper,
  fixedIncludefilterOption,
  fixedJoinOptionsAndOrObject,
  fixedNotTextFilter,
  fixedSetFilter,
  fixedSimpleBadFilter,
  fixedSimpleDateFilter,
  fixedSimpleNumberFilter,
  fixedSimpleTextFilter,
  fixedUndefinedTextFilter,
  fixedWhereTransformed,
  fixedWhereTransformedNested,
  fixedWhereTransformedWithExcluded,
  fixedWhereTransformedWithNotInclude,
  fixeNumberArgs,
  genExtraArgs,
} from '../__mocks__/filter.mocks.js';
import {
  ArgumentsError,
  MissingArgumentsError,
} from '../missing-arguments.error.js';
import { TestEntity } from '../__mocks__/entity.mock.js';

const firstTextParameter = 'a';
const firstNumberParameter = 1;
const secondNumberParameter = 2;
const newDate = new Date();
const firstDateParameter = newDate.toDateString();
const secondDateParameter = newDate.toDateString();
const firstDateParameterPlus1Day = new Date(
  newDate.getDate() + 1,
).toDateString();
const inDateResults = [
  {
    from: DateHelper.dateToSQLDateTime(
      new Date(new Date(firstDateParameter).setHours(0, 0, 0, 0)),
    ),
    to: DateHelper.dateToSQLDateTime(
      new Date(new Date(firstDateParameter).setHours(23, 59, 59, 999)),
    ),
  },
  {
    from: DateHelper.dateToSQLDateTime(
      new Date(new Date(firstDateParameter).setHours(0, 0, 0, 0)),
    ),
    to: DateHelper.dateToSQLDateTime(
      new Date(new Date(firstDateParameterPlus1Day).setHours(23, 59, 59, 999)),
    ),
  },
];

const switchCaseTextTests = [
  {
    filter: 'equals',
    result: Equal(firstTextParameter),
  },
  {
    filter: 'equal',
    result: Equal(firstTextParameter),
  },
  {
    filter: 'StartsWith',
    result: Like(`${firstTextParameter}%`),
  },
  {
    filter: 'EndsWith',
    result: Like(`%${firstTextParameter}`),
  },
  {
    filter: 'Contains',
    result: Like(`%${firstTextParameter}%`),
  },
];
const switchCaseNumberTests = [
  {
    filter: 'equals',
    result: Equal(firstNumberParameter),
  },
  {
    filter: 'equal',
    result: Equal(firstNumberParameter),
  },
  {
    filter: 'lessthan',
    result: LessThan(firstNumberParameter),
  },
  {
    filter: 'LessThanOrEqual',
    result: LessThanOrEqual(firstNumberParameter),
  },
  {
    filter: 'greaterThan',
    result: MoreThan(firstNumberParameter),
  },
  {
    filter: 'greaterThanOrEqual',
    result: MoreThanOrEqual(firstNumberParameter),
  },
  {
    filter: 'inRange',
    result: Between(firstNumberParameter, secondNumberParameter),
  },
];
const switchCaseDateTests = [
  {
    filter: 'equals',
    result: Equal(firstDateParameter),
  },
  {
    filter: 'equal',
    result: Equal(firstDateParameter),
  },
  {
    filter: 'lessthan',
    result: LessThan(firstDateParameter),
  },
  {
    filter: 'greaterThan',
    result: MoreThan(firstDateParameter),
  },
  {
    filter: 'inRange',
    result: Between(firstDateParameter, secondDateParameter),
  },
  {
    filter: 'inDate',
    result: Between(inDateResults[0].from, inDateResults[0].to),
  },
];

const fixedKey = 'passed';
const dbName = 'original';

const infoObj = {
  fieldNodes: [
    {
      selectionSet: {
        selections: [
          {
            name: {
              value: 'first',
            },
          },
          {
            name: {
              value: 'second',
            },
          },
          {
            name: {
              value: fixedKey,
            },
          },
          {
            name: {
              value: dbName,
            },
          },
        ],
      },
    },
  ],
};

const fixedDataFilterToInclude: ICrudGenGqlArgsOptions = {
  fieldMap: {
    field: fixedIFieldMapper,
    filterOption: fixedIncludefilterOption,
  },
};

const mockedInfo = createMock<GraphQLResolveInfo>();

const mockCreate = (mockedNestGraphql().GqlExecutionContext.create = jest.fn());
mockCreate.mockImplementation(() => ({
  getArgs: jest.fn().mockReturnValue(fixedArgsQueryParams),
  getContext: jest.fn().mockReturnValue({}),
  getInfo: jest.fn().mockReturnValue(infoObj),
}));
const mockedGqlExecutionContext = GqlExecutionContext.create(
  mockedExecutionContext,
);

describe('Crud-gen args decorator', () => {
  it('Check getTextFilter functionality', async () => {
    let testgetTextFilter;
    for (const test of switchCaseTextTests) {
      testgetTextFilter = crudGenArgsDecorator.getTextFilter(
        test.filter,
        firstTextParameter,
      );
      expect(testgetTextFilter).toBeDefined();
      expect(testgetTextFilter).toEqual(test.result);
    }
  });

  it('Check getNumberFilter functionality', async () => {
    let testgetTextFilter;
    for (const test of switchCaseNumberTests) {
      testgetTextFilter = crudGenArgsDecorator.getNumberFilter(
        test.filter,
        firstNumberParameter,
        secondNumberParameter,
      );
      expect(testgetTextFilter).toBeDefined();
      expect(testgetTextFilter).toEqual(test.result);
    }
  });

  it('Check getDateFilter functionality', async () => {
    let testgetTextFilter;
    for (const test of switchCaseDateTests) {
      testgetTextFilter = crudGenArgsDecorator.getDateFilter(
        test.filter,
        firstDateParameter,
        secondDateParameter,
      );
      expect(testgetTextFilter).toBeDefined();
      expect(testgetTextFilter).toEqual(test.result);
    }
  });

  it('Check inDate filter functionality', async () => {
    const testGetStringFilter = crudGenArgsDecorator.getDateFilter(
      GeneralFilters.INDATE,
      firstDateParameter,
      firstDateParameterPlus1Day,
    );
    expect(testGetStringFilter).toBeDefined();
    expect(testGetStringFilter).toEqual(
      Between(inDateResults[1].from, inDateResults[1].to),
    );
  });

  it('Check inDate filter functionality whith only 1 date', async () => {
    const testGetStringFilter = crudGenArgsDecorator.getDateFilter(
      GeneralFilters.INDATE,
      firstDateParameter,
    );
    expect(testGetStringFilter).toBeDefined();
    expect(testGetStringFilter).toEqual(
      Between(inDateResults[0].from, inDateResults[0].to),
    );
  });

  it('Check get filters errors', async () => {
    expect(() =>
      crudGenArgsDecorator.getTextFilter('ImAnError', firstTextParameter),
    ).toThrowError(
      new CrudGenFilterNotSupportedError(`filter: ImAnError type: TEXT`),
    );
    expect(() =>
      crudGenArgsDecorator.getNumberFilter('ImAnError', firstNumberParameter),
    ).toThrowError(
      new CrudGenFilterNotSupportedError(`filter: ImAnError type: NUMBER`),
    );
    expect(() =>
      crudGenArgsDecorator.getDateFilter('ImAnError', firstDateParameter),
    ).toThrowError(
      new CrudGenFilterNotSupportedError(`filter: ImAnError type: DATE`),
    );
  });

  it('Check CrudGenArgsFactory functionality', async () => {
    const testData = crudGenArgsDecorator.CrudGenArgsFactory(
      fixedArgsOptions,
      mockedExecutionContext,
    );

    expect(testData).toBeDefined();
  });

  describe('Check mapCrudGenParams', () => {
    // Mocked function
    const objectToFieldMapper = jest.spyOn(
      CrudGenHelpers,
      'objectToFieldMapper',
    );

    const testData: [string, ICrudGenParams][] = [
      ['text filter', fixedArgsQueryParams],
      ['number filter', fixeNumberArgs],
      ['data filter', fixeDatedArgs],
      ['bad filter', fixedBadArgs],
      ['no filter', fixedArgsNoFilters],
    ];

    const resultFn = (params) => () =>
      crudGenArgsDecorator.mapCrudGenParams(
        params,
        mockedGqlExecutionContext,
        fixedArgsQueryParams,
        mockedInfo,
      );

    it.each(testData)('Should map on %s', (name, args) => {
      const result = crudGenArgsDecorator.mapCrudGenParams(
        fixedArgsOptions,
        mockedGqlExecutionContext,
        args,
        mockedInfo,
      );

      expect(result).toBeDefined();
    });

    it('Should throw error with bad extraArgs property', () => {
      const params: ICrudGenGqlArgsOptions = {
        ...fixedArgsOptions,
        extraArgsStrategy: ExtraArgsStrategy.AT_LEAST_ONE,
        extraArgs: {
          ...genExtraArgs('extra'),
        },
      };

      expect(resultFn(params)).toThrow(MissingArgumentsError);

      params.extraArgsStrategy = ExtraArgsStrategy.ONLY_ONE;
      params.extraArgs = {
        ...genExtraArgs('rowGroups'),
        ...genExtraArgs('groupKeys'),
      };

      expect(resultFn(params)).toThrow(ArgumentsError);
    });

    it('Should work properly with extraArgs property', () => {
      const params: ICrudGenGqlArgsOptions = {
        ...fixedArgsOptions,
        extraArgsStrategy: ExtraArgsStrategy.AT_LEAST_ONE,
        extraArgs: {
          ...genExtraArgs('groupKeys'),
        },
      };

      expect(resultFn(params)()).toBeDefined();
      params.extraArgsStrategy = ExtraArgsStrategy.ONLY_ONE;
      params.extraArgs = {
        ...genExtraArgs('rowGroups'),
      };

      expect(resultFn(params)()).toBeDefined();

      params.extraArgsStrategy = ExtraArgsStrategy.DEFAULT;
      expect(resultFn(params)()).toBeDefined();
    });

    it('Should work properly with extraArgs property with middleware ', () => {
      const params: ICrudGenGqlArgsOptions = {
        ...fixedArgsOptions,
        extraArgsStrategy: ExtraArgsStrategy.AT_LEAST_ONE,
        extraArgs: {
          ...genExtraArgs('groupKeys'),
        },
      };

      expect(resultFn(params)()).toBeDefined();
      params.extraArgsStrategy = ExtraArgsStrategy.ONLY_ONE;
      params.extraArgs = {
        ...genExtraArgs('rowGroups'),
      };

      expect(resultFn(params)()).toBeDefined();

      params.extraArgsStrategy = ExtraArgsStrategy.DEFAULT;
      expect(resultFn(params)()).toBeDefined();
    });

    it('Should add extraArgs with VIRTUAL filter in extra field of findManyOptions', () => {
      const params: ICrudGenGqlArgsOptions = {
        ...fixedArgsOptions,
        extraArgs: {
          virtualArg: {
            filterType: FilterType.TEXT,
            filterCondition: GeneralFilters.VIRTUAL,
            options: {
              defaultValue: 'defaultValue',
            },
          },
        },
      };
      const findManyOptions = resultFn(params)();
      expect(findManyOptions).toBeDefined();
      const argsKeys = Object.keys(findManyOptions.extra.args);
      expect(argsKeys).toContain('virtualArg');
    });

    it('Check mapCrudGenParams functionality with fieldType defined', async () => {
      objectToFieldMapper.mockReturnValue({
        filterOption: {} as any,
        field: {},
      });

      let testData = resultFn(fixedDataFilterToInclude)();
      expect(testData).toBeDefined();

      fixedDataFilterToInclude.fieldType = BaseEntity;
      testData = resultFn(fixedDataFilterToInclude)();
      expect(testData).toBeDefined();

      fixedDataFilterToInclude.fieldType = undefined;
      fixedDataFilterToInclude.fieldMap = undefined;
      fixedDataFilterToInclude.entityType = TestEntity;
      testData = resultFn(fixedDataFilterToInclude)();
      expect(testData).toBeDefined();
    });
  });

  it('Check filters with undefined data', async () => {
    const testData = crudGenArgsDecorator.mapCrudGenParams(
      undefined,
      mockedGqlExecutionContext,
      fixedArgsNOTFilter,
      mockedInfo,
    );

    expect(testData).toBeDefined();
  });

  it('Check mapCrudGenParams functionality with default values', async () => {
    const testData = crudGenArgsDecorator.mapCrudGenParams(
      fixedDataWithDefault,
      mockedGqlExecutionContext,
      { filters: {}, startRow: undefined, endRow: 5 },
      mockedInfo,
    );

    expect(testData).toBeDefined();
  });

  it('Check mapCrudGenParams throws error if row selected is too high', () => {
    try {
      crudGenArgsDecorator.mapCrudGenParams(
        fixedArgsOptions,
        mockedGqlExecutionContext,
        { filters: {}, startRow: 0, endRow: 500 },
        mockedInfo,
      );
    } catch (error) {
      const { maxRow } = fixedArgsOptions.options;
      expect(error).toEqual(
        new CrudGenError(
          `Invalid max number of row selected: cannot exeed max ${maxRow}`,
        ),
      );
    }
  });

  it('Check default functionality with sorting ASC', () => {
    const testData = crudGenArgsDecorator.mapCrudGenParams(
      { ...fixedDataWithDefault, defaultValue: undefined },
      mockedGqlExecutionContext,
      { filters: {}, startRow: undefined, endRow: 5 },
      mockedInfo,
    );

    expect(testData).toBeDefined();
  });

  describe('resolveFilter', () => {
    const testData: [string, FilterModel][] = [
      ['text', fixedSimpleTextFilter],
      ['number', fixedSimpleNumberFilter],
      ['date', fixedSimpleDateFilter],
      ['set', fixedSetFilter],
      ['not supported', {} as FilterModel],
    ];

    it.each(testData)('Check conversion with %s filter', (name, filter) => {
      try {
        const result = crudGenArgsDecorator.resolveFilter(filter);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(CrudGenFilterNotSupportedError);
      }
    });
  });
  describe('Check convertFilter', () => {
    const testData: [
      string,
      FilterModel | ICombinedSimpleModel,
      CrudGenError?,
    ][] = [
      ['simple', fixedSimpleTextFilter, undefined],
      [
        'undefined',
        fixedUndefinedTextFilter,
        new CrudGenInvalidArgumentError(),
      ],
      ['combined OR', fixedCombinedOrTextFilter, undefined],
      ['combined AND', fixedCombinedAndTextFilter, undefined],
      [
        'combined invalid operator',
        <ICombinedSimpleModel>fixedCombinedInvalidOperatorTextFilter,
        new CrudGenInvalidOperatorError(),
      ],
      [
        'combined invalid args',
        fixedCombinedInvalidArgsTextFilter,
        new CrudGenInvalidArgumentError(),
      ],
      ['not type in text', fixedNotTextFilter, undefined],
    ];

    it.each(testData)(`Should convert %s Filter`, (name, filter, error) => {
      if (error) {
        const result = () => crudGenArgsDecorator.convertFilter(filter);
        expect(result).toThrowError(error);
      } else {
        const result = crudGenArgsDecorator.convertFilter(filter);
        expect(result).toBeDefined();
      }
    });
  });

  it('should check filterSwitch is working properly', async () => {
    // with SET
    let testData = crudGenArgsDecorator.filterSwitch(fixedSetFilter);

    expect(testData).toStrictEqual(In(fixedSetFilter.values));

    // with TEXT
    testData = crudGenArgsDecorator.filterSwitch(
      fixedSimpleTextFilter,
      'contains',
    );
    expect(testData).toStrictEqual(Like(`%${fixedSimpleTextFilter.filter}%`));

    // with Date
    testData = crudGenArgsDecorator.filterSwitch(
      fixedSimpleDateFilter,
      'equal',
    );
    expect(testData).toStrictEqual(Equal(`${fixedSimpleDateFilter.dateFrom}`));

    // With number
    testData = crudGenArgsDecorator.filterSwitch(
      fixedSimpleNumberFilter,
      'equal',
    );
    expect(testData).toStrictEqual(Equal(fixedSimpleNumberFilter.filter));

    // with INVALID

    expect(() =>
      crudGenArgsDecorator.filterSwitch(fixedSimpleBadFilter),
    ).toThrow(CrudGenFilterNotSupportedError);
  });

  it('Check removeSymbolicSelection work', async () => {
    const testData = crudGenArgsDecorator.removeSymbolicSelection(
      [`second_${fixedKey}`, `third_${fixedKey}`],
      fixedIFieldMapper,
      '',
    );

    expect(testData).toEqual([`second_${fixedKey}`]);
  });

  describe('Check createWhere', () => {
    it('Should work with void where', async () => {
      const testData = crudGenArgsDecorator.createWhere(
        null,
        fixedIFieldMapper,
      );
      expect(testData).toEqual({ filters: {} });
    });

    it(`Should work properly with filterInput object`, () => {
      const testData = crudGenArgsDecorator.createWhere(
        fixedJoinOptionsAndOrObject,
        fixedIFieldMapper,
        'alias',
        { childExpressions: [], filters: {} },
      );

      expect(testData).toBeDefined();
    });

    it('Should throw error with bad filters', () => {
      const badFilter: FilterInput = {
        ...fixedJoinOptionsAndOrObject,
        expressions: [
          {
            text: fixedSimpleTextFilter,
            number: fixedSimpleNumberFilter,
          },
        ],
      };

      expect(() =>
        crudGenArgsDecorator.createWhere(badFilter, fixedIFieldMapper),
      ).toThrowError(
        `Field can't use more than one expression type on same expression: text,number`,
      );

      const badFilter2 = {
        ...badFilter,
        expressions: [
          {
            nothing: undefined,
          } as any,
        ],
      };

      expect(() =>
        crudGenArgsDecorator.createWhere(badFilter2, fixedIFieldMapper),
      ).toThrowError('Expression not found! It should never happen');

      const badFilter3: FilterInput = {
        ...badFilter,
        expressions: [
          {
            text: { field: 'ok' },
          } as any,
        ],
      };

      expect(() =>
        crudGenArgsDecorator.createWhere(badFilter3, fixedIFieldMapper),
      ).toThrowError(CrudGenFilterNotSupportedError);
    });
  });

  it('Check checkFilterScope with where and include option', async () => {
    expect.assertions(1);
    try {
      const testData = crudGenArgsDecorator.checkFilterScope(
        fixedWhereTransformed,
        fixedIncludefilterOption,
      );
      expect(testData).not.toBeDefined();
    } catch (error) {
      expect(error).not.toBeDefined();
    }
  });

  it('Check checkFilterScope with where and exclude option', async () => {
    expect.assertions(1);
    try {
      const testData = crudGenArgsDecorator.checkFilterScope(
        fixedWhereTransformed,
        fixedExcludefilterOption,
      );
      expect(testData).not.toBeDefined();
    } catch (error) {
      expect(error).not.toBeDefined();
    }
  });

  it('Check checkFilterScope with not included filter', async () => {
    expect.assertions(1);
    try {
      crudGenArgsDecorator.checkFilterScope(
        fixedWhereTransformedWithNotInclude,
        fixedIncludefilterOption,
      );
    } catch (error) {
      expect(error).toEqual(new CrudGenFilterProhibited());
    }
  });

  it('Check checkFilterScope with excluded filter', async () => {
    expect.assertions(1);
    try {
      crudGenArgsDecorator.checkFilterScope(
        fixedWhereTransformedWithExcluded,
        fixedExcludefilterOption,
      );
    } catch (error) {
      expect(error).toEqual(new CrudGenFilterProhibited());
    }
  });

  it('Check checkFilterScope with where and include option', async () => {
    expect.assertions(1);
    try {
      const testData = crudGenArgsDecorator.checkFilterScope(
        fixedWhereTransformedNested,
        fixedIncludefilterOption,
      );
      expect(testData).not.toBeDefined();
    } catch (error) {
      expect(error).not.toBeDefined();
    }
  });

  // Not the prettiest test, but since a lot is actually a decorator under the hood i think this is fine, we do not call this directly normally
  it('should be able to use the CrudGenArgs to combine param decorators', () => {
    const ArgsFunc = jest.spyOn(graphql, 'Args');
    const returnFunc = jest.fn().mockReturnValue('somestring');
    ArgsFunc.mockReturnValue(returnFunc);
    //Without params type
    let decorator = crudGenArgsDecorator.CrudGenArgs(fixedArgsOptions);
    expect(decorator).toEqual(expect.any(Function));
    decorator('', '', 0);
    expect(returnFunc).toHaveBeenCalled();
    //With params type
    decorator = crudGenArgsDecorator.CrudGenArgs(fixedArgsOptions);
    expect(decorator).toEqual(expect.any(Function));
    decorator('', '', 0);
    expect(returnFunc).toHaveBeenCalled();
  });

  it('should be able to use the CrudGenArgsNoPagination to combine param decorators', () => {
    const ArgsFunc = jest.spyOn(graphql, 'Args');
    const returnFunc = jest.fn().mockReturnValue('somestring');
    ArgsFunc.mockReturnValue(returnFunc);
    //With params type
    const argsOptions: ICrudGenGqlArgsOptions = {
      ...fixedArgsOptions,
      entityType: BaseEntity,
    };
    let decorator = crudGenArgsDecorator.CrudGenArgsNoPagination(argsOptions);
    expect(decorator).toEqual(expect.any(Function));
    decorator('', '', 0);
    expect(returnFunc).toHaveBeenCalled();
    //Without params type
    decorator = crudGenArgsDecorator.CrudGenArgsNoPagination({});
    expect(decorator).toEqual(expect.any(Function));
    decorator('', '', 0);
    expect(returnFunc).toHaveBeenCalled();
  });

  it('Should combine decorators with CrudGenCombineDecorators', () => {
    jest.spyOn(CrudGenInput, 'agJoinArgFactory').mockReturnValueOnce({});

    const ArgsFunc = jest.spyOn(graphql, 'Args');
    const returnFunc = jest.fn().mockReturnValue('somestring');
    ArgsFunc.mockReturnValue(returnFunc);

    const argsOptions: ICrudGenGqlArgsOptions = {
      ...fixedArgsOptions,
      entityType: BaseEntity,
    };
    const decorator =
      crudGenArgsDecorator.CrudGenCombineDecorators(argsOptions);
    decorator({}, 'key', 0);
    expect(decorator).toEqual(expect.any(Function));
  });

  it('Should combine decorators with default values with CrudGenCombineDecorators', () => {
    const ArgsFunc = jest.spyOn(graphql, 'Args');
    const returnFunc = jest.fn().mockReturnValue('somestring');
    ArgsFunc.mockReturnValue(returnFunc);

    const defaultArgsOptions: ICrudGenGqlArgsOptions = {
      ...fixedArgsOptions,
      extraArgs: {
        ['default']: {
          options: undefined,
        } as any,
      },
      gql: undefined,
    };
    const decorator =
      crudGenArgsDecorator.CrudGenCombineDecorators(defaultArgsOptions);
    expect(decorator).toEqual(expect.any(Function));
  });

  describe('Check CrudGenArgsSingleDecoratorMapper', () => {
    const qqlModelFieldsMapper = jest.spyOn(
      GqlCrudGenDecorator,
      'GqlModelFieldsMapper',
    );

    const objectToFieldMapper = jest.spyOn(
      CrudGenHelpers,
      'objectToFieldMapper',
    );

    beforeEach(() => {
      qqlModelFieldsMapper.mockReturnValueOnce({
        keys: ['field'],
        keysMeta: { field: {} },
      });
      objectToFieldMapper.mockReturnValueOnce({ field: {} });
    });

    afterEach(() => {
      qqlModelFieldsMapper.mockReset();
      objectToFieldMapper.mockReset();
    });

    it('Should map to FindManyOptions', () => {
      const argsOptions: ICrudGenGqlArgsOptions = {
        ...fixedArgsOptions,
        fieldType: BaseEntity,
        entityType: BaseEntity,
      };
      const result = crudGenArgsDecorator.CrudGenArgsSingleDecoratorMapper(
        argsOptions,
        fixedArgsQueryParams,
        mockedInfo,
      );

      expect(result.select).toEqual(['field']);
    });

    it('Should map to findManyOptions with bad arguments', () => {
      const argsOptions: ICrudGenGqlArgsOptions = {
        ...fixedArgsOptions,
        entityType: BaseEntity,
      };

      const queryParam: ICrudGenParams = {
        ...fixedArgsQueryParams,
        join: null,
      };
      const result = crudGenArgsDecorator.CrudGenArgsSingleDecoratorMapper(
        argsOptions,
        queryParam,
        mockedInfo,
      );

      expect(result.select).toEqual(['field']);
      expect(qqlModelFieldsMapper).toHaveBeenCalled();
      expect(objectToFieldMapper).toHaveBeenCalled();
    });

    it('Should return an empty findManyOptions with bad arguments', () => {
      const argsOptions: ICrudGenGqlArgsOptions = {
        ...fixedArgsOptions,
      };

      let result = crudGenArgsDecorator.CrudGenArgsSingleDecoratorMapper(
        argsOptions,
        fixedArgsQueryParams,
        mockedInfo,
      );

      expect(result).toEqual({});

      result = crudGenArgsDecorator.CrudGenArgsSingleDecoratorMapper(
        null,
        fixedArgsQueryParams,
        mockedInfo,
      );
      expect(result).toEqual({});
      expect(qqlModelFieldsMapper).not.toHaveBeenCalled();
      expect(objectToFieldMapper).not.toHaveBeenCalled();
    });
  });

  it('Should be able to use the CrudGenArgsSingle', () => {
    const ArgsFunc = jest.spyOn(graphql, 'Args');
    const returnFunc = jest.fn().mockReturnValue('somestring');
    ArgsFunc.mockReturnValue(returnFunc);

    const joinArgFactory = jest
      .spyOn(CrudGenInput, 'agJoinArgFactory')
      .mockReturnValueOnce({});

    const checkExpect = () => {
      decorator('', '', 0);
      expect(returnFunc).toHaveBeenCalled();
      expect(joinArgFactory).toHaveBeenCalled();
    };

    const argsOptions: ICrudGenGqlArgsOptions = {
      ...fixedArgsOptions,
      entityType: BaseEntity,
    };

    let decorator = crudGenArgsDecorator.CrudGenArgsSingle(argsOptions);
    checkExpect();

    joinArgFactory.mockReturnValueOnce(null);
    decorator = crudGenArgsDecorator.CrudGenArgsSingle(argsOptions);
    checkExpect();

    argsOptions.entityType = null;
    decorator = crudGenArgsDecorator.CrudGenArgsSingle(argsOptions);
    checkExpect;
  });

  it('Should be call CrudGenArgsSingleDecoratorFactory correctly', () => {
    const decorator = crudGenArgsDecorator.CrudGenArgsSingleDecoratorFactory(
      fixedArgsOptions,
      mockedGqlExecutionContext,
    );
    expect(decorator).toBeDefined();
  });

  describe('getFindOperator', () => {
    const testData = [
      {
        type: fixedSimpleTextFilter.filterType,
        name: GeneralFilters.EQUALS,
        arg1: firstTextParameter,
        arg2: undefined,
      },
      {
        type: fixedSimpleDateFilter.filterType,
        name: GeneralFilters.EQUALS,
        arg1: firstDateParameter,
        arg2: secondDateParameter,
      },
      {
        type: fixedSimpleNumberFilter.filterType,
        name: GeneralFilters.EQUALS,
        arg1: firstNumberParameter,
        arg2: undefined,
      },
      {
        type: fixedSetFilter.filterType,
        name: GeneralFilters.EQUALS,
        arg1: '',
        arg2: undefined,
      },
      {
        type: fixedSetFilter.filterType,
        name: GeneralFilters.ISNULL,
        arg1: undefined,
        arg2: undefined,
      },
    ];

    it('Should work properly', () => {
      testData.forEach((test) => {
        const result = crudGenArgsDecorator.getFindOperator(
          test.type,
          test.name,
          test.arg1,
          test.arg2,
        );
        expect(result).toBeDefined();
      });
    });
  });
});
