import { describe, expect, it, jest, afterEach } from '@jest/globals';
import {
  convertFilter,
  createWhere,
  mapCrudGenParam,
  checkFilterScope,
  filterSwitch,
  getDateFilter,
  getFindOperator,
  getNumberFilter,
  getTextFilter,
  mapPaginationParamsToTypeORM,
  mapSortingParamsToTypeORM,
  removeSymbolicSelection,
  resolveFilter,
} from '../typeorm/crud-gen-args.helpers.js';
import {
  FilterType,
  GeneralFilters,
  Operators,
  RowDefaultValues,
  SortDirection,
} from '../crud-gen.enum.js';
import {
  CrudGenError,
  CrudGenFilterNotSupportedError,
  CrudGenInvalidArgumentError,
  CrudGenInvalidOperatorError,
  CrudGenFilterProhibited,
} from '../crud-gen.error.js';
import type {
  FilterInput,
  ICombinedSimpleModel,
  ISetFilterModel,
  ITextFilterModel,
} from '../api-graphql/crud-gen-gql.interface.js';
import { FilterOptionType } from '../object.decorator.js';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('crud-gen args helpers', () => {
  it('should build find operators for text, number and date', () => {
    const text = getTextFilter(GeneralFilters.CONTAINS, 'abc');
    expect((text as any)._value).toBe('%abc%');

    const range = getNumberFilter(
      GeneralFilters.INRANGE,
      1,
      3,
    ) as any;
    expect(range._value).toEqual([1, 3]);

    const inDate = getDateFilter(
      GeneralFilters.INDATE,
      '2020-01-01',
      '2020-01-02',
    ) as any;
    expect(inDate._value).toBeDefined();

    expect(() => getTextFilter('unknown' as any, 'x')).toThrow(
      CrudGenFilterNotSupportedError,
    );
  });

  it('should support start/end/compare filters and error branches', () => {
    expect((getTextFilter(GeneralFilters.STARTSWITH, 'z') as any)._value).toBe(
      'z%',
    );
    expect((getTextFilter(GeneralFilters.ENDSWITH, 'z') as any)._value).toBe(
      '%z',
    );

    const greater = getNumberFilter(GeneralFilters.GREATERTHAN, 5) as any;
    expect(greater._value).toBe(5);
    const lessOrEq = getNumberFilter(GeneralFilters.LESSTHANOREQUAL, 3) as any;
    expect(lessOrEq._value).toBe(3);
    expect((getNumberFilter(GeneralFilters.LESSTHAN, 2) as any)._value).toBe(2);
    expect(
      (getNumberFilter(GeneralFilters.GREATERTHANOREQUAL, 4) as any)._value,
    ).toBe(4);
    expect(() => getNumberFilter('invalid', 1)).toThrow(
      CrudGenFilterNotSupportedError,
    );

    const eqDate = getDateFilter(GeneralFilters.EQUAL, '2020-01-01') as any;
    expect(eqDate._value).toBe('2020-01-01');
    expect(
      (getDateFilter(GeneralFilters.LESSTHAN, '2020-01-01') as any)._value,
    ).toBe('2020-01-01');
    expect(
      (getDateFilter(GeneralFilters.GREATERTHAN, '2020-01-02') as any)._value,
    ).toBe('2020-01-02');
    expect(
      (getDateFilter(GeneralFilters.INRANGE, '2020-01-01', '2020-01-02') as any)
        ._value,
    ).toEqual(['2020-01-01', '2020-01-02']);
    expect(() => getDateFilter('invalid', '2020-01-01')).toThrow(
      CrudGenFilterNotSupportedError,
    );
  });

  it('should map set filters and combined filters', () => {
    const setFilter: ISetFilterModel = {
      filterType: FilterType.SET,
      field: 'status',
      values: ['ok', 'ko'],
    };

    const setOp = filterSwitch(setFilter) as any;
    expect(setOp._value).toEqual(['ok', 'ko']);

    const combined: ICombinedSimpleModel = {
      filterType: FilterType.TEXT,
      operator: Operators.OR,
      condition1: {
        filterType: FilterType.TEXT,
        type: GeneralFilters.EQUALS,
        field: 'name',
        filter: 'a',
      } as ITextFilterModel,
      condition2: {
        filterType: FilterType.TEXT,
        type: GeneralFilters.EQUALS,
        field: 'name',
        filter: 'b',
      } as ITextFilterModel,
    };

    expect(convertFilter(combined)).toEqual({
      operator: combined.operator,
      filter_1: expect.anything(),
      filter_2: expect.anything(),
    });

    const numericFilter = {
      filterType: FilterType.NUMBER,
      type: GeneralFilters.LESSTHAN,
      field: 'count',
      filter: 5,
      filterTo: 10,
    };
    const numericOp = filterSwitch(numericFilter as any) as any;
    expect(numericOp._value).toBe(5);

    expect(() =>
      convertFilter({ ...combined, operator: 'X' as any }),
    ).toThrow(CrudGenInvalidOperatorError);
  });

  it('should resolve filters and throw on invalid input', () => {
    const text: ITextFilterModel = {
      filterType: FilterType.TEXT,
      type: GeneralFilters.EQUALS,
      field: 'name',
      filter: 'abc',
    };

    expect(resolveFilter(text)).toBeDefined();

    expect(() =>
      resolveFilter({ filterType: FilterType.MULTI } as any),
    ).toThrow(CrudGenFilterNotSupportedError);

    expect(() => filterSwitch({} as any)).toThrow(
      CrudGenInvalidArgumentError,
    );
  });

  it('should apply NOT operators and validate filter types', () => {
    const notFilter = {
      filterType: FilterType.TEXT,
      type: 'notContains',
      field: 'name',
      filter: 'abc',
    } as any;

    const result = convertFilter(notFilter) as any;
    expect(result._type).toBe('not');
    expect((result._value as any)._value).toBe('%abc%');

    expect(() =>
      getFindOperator('MULTI' as any, 'unsupported', 'x'),
    ).toThrow(CrudGenFilterNotSupportedError);

    const numberOp = getFindOperator(
      FilterType.NUMBER,
      GeneralFilters.EQUAL,
      10,
    ) as any;
    expect(numberOp._value).toBe(10);
    const dateOp = getFindOperator(
      FilterType.DATE,
      GeneralFilters.EQUALS,
      '2020-01-01',
    ) as any;
    expect(dateOp._value).toBe('2020-01-01');
  });

  it('should create where conditions from filter input', () => {
    const input: FilterInput = {
      operator: Operators.OR,
      expressions: [
        {
          [FilterType.TEXT]: {
            filterType: FilterType.TEXT,
            type: GeneralFilters.CONTAINS,
            field: 'name',
            filter: 'x',
          },
        },
      ],
    };

    const where = createWhere(input, undefined);
    expect(where.childExpressions?.length).toBe(1);
    expect(where.operator).toBe(Operators.OR);
  });

  it('should process child expressions and reject unsupported filters', () => {
    const nested: FilterInput = {
      expressions: [
        {
          [FilterType.TEXT]: {
            filterType: FilterType.TEXT,
            type: GeneralFilters.CONTAINS,
            field: 'name',
            filter: 'x',
          },
        },
      ],
      childExpressions: [
        {
          expressions: [
            {
              [FilterType.TEXT]: {
                filterType: 'UNKNOWN' as any,
                field: 'name',
                filter: 'x',
              } as any,
            },
          ],
        } as any,
      ],
    };

    expect(() => createWhere(nested, undefined)).toThrow(
      CrudGenFilterNotSupportedError,
    );
  });

  it('should validate expressions and scope in createWhere', () => {
    const invalidExpression: FilterInput = {
      expressions: [
        {
          [FilterType.TEXT]: {
            field: 'name',
            filterType: FilterType.TEXT,
            filter: 'x',
            type: GeneralFilters.CONTAINS,
          },
          [FilterType.NUMBER]: {
            field: 'age',
            filterType: FilterType.NUMBER,
            filter: 1,
            type: GeneralFilters.EQUAL,
          },
        } as any,
      ],
    };
    expect(() => createWhere(invalidExpression, undefined)).toThrow(
      CrudGenError,
    );

    const missingField: FilterInput = {
      expressions: [
        {
          [FilterType.TEXT]: {
            filterType: FilterType.TEXT,
            type: GeneralFilters.CONTAINS,
            filter: 'x',
          } as any,
        },
      ],
    };
    expect(() => createWhere(missingField, undefined)).toThrow(Error);

    const scopedWhere = { filters: {}, childExpressions: [{ filters: { foo: 1 } }] } as any;
    expect(() =>
      checkFilterScope(scopedWhere, {
        type: FilterOptionType.EXCLUDE,
        fields: ['foo'],
      } as any),
    ).toThrow(CrudGenFilterProhibited);
  });

  it('should map pagination params enforcing max rows', () => {
    const normal = mapPaginationParamsToTypeORM(0, 10, 20);
    expect(normal).toEqual({ skip: 0, take: 10 });

    expect(() => mapPaginationParamsToTypeORM(0, 50, 5)).toThrow(
      CrudGenError,
    );

    const defaults = mapPaginationParamsToTypeORM(
      undefined,
      undefined,
      RowDefaultValues.MAX_ROW,
    );
    expect(defaults.take).toBe(RowDefaultValues.MAX_ROW);

    const unlimited = mapPaginationParamsToTypeORM(5, 15, 0);
    expect(unlimited).toEqual({ skip: 5, take: 10 });
  });

  it('should map sorting params with transformer', () => {
    const order = mapSortingParamsToTypeORM(
      [
        { colId: 'name', sort: SortDirection.DESC },
        { colId: 'createdAt', sort: undefined as any },
      ] as any,
      (col) => `t.${String(col)}` as any,
    );

    expect(order).toEqual({
      't.name': 'DESC',
      't.createdAt': 'ASC',
    });
  });

  it('should remove symbolic selections and detect IS NULL', () => {
    const select = ['id', 'virtual'];
    const mapper = {
      virtual: { isSymbolic: true },
    } as any;

    const filtered = removeSymbolicSelection(select, mapper, '');
    expect(filtered).toEqual(['id']);

    const isNull = getFindOperator(
      FilterType.TEXT,
      GeneralFilters.ISNULL,
      null,
    );
    expect(isNull).toBeDefined();
  });

  it('should map crud-gen params with derived fields and joins', () => {
    const fieldType: any = {
      filterOption: { type: FilterOptionType.INCLUDE, fields: ['name', 'derived'] },
      field: {
        name: { dst: 'name' },
        derived: { dst: 'raw_expr', mode: 'derived' },
        relation: { dst: 'relation', gqlType: () => undefined },
      },
    };
    const params: any = {
      fieldType,
      options: { maxRow: 10 },
      entityType: class Entity {},
    };
    const select = { keys: ['id'], keysMeta: { id: { alias: 'id' } } };
    const args: any = {
      startRow: 1,
      endRow: 3,
      sorting: [{ colId: 'derived', sort: SortDirection.DESC }],
      join: { relation: { joinType: 'LEFT_JOIN' } },
      filters: {
        expressions: [
          {
            [FilterType.TEXT]: {
              filterType: FilterType.TEXT,
              type: GeneralFilters.EQUAL,
              field: 'name',
              filter: 'alice',
            },
          },
        ],
      },
    };

    const mapped = mapCrudGenParam(params, select as any, args, {
      isCount: true,
    });

    expect(mapped.extra.skipCount).toBe(false);
    expect(mapped.order).toEqual({ raw_expr: 'DESC' });
    expect(mapped.where.filters).toBeDefined();
    expect(mapped.join?.leftJoinAndSelect?.relation).toBe('Entity.relation');
  });
});
