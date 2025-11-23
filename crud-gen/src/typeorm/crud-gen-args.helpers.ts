import { IFieldMapper } from '@nestjs-yalc/interfaces';
import { DateHelper } from '@nestjs-yalc/utils/date.helper.js';
import {
  Equal,
  Like,
  FindOperator,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Between,
  In,
  IsNull,
  Not,
  ObjectLiteral,
  FindOptionsOrder,
} from 'typeorm';
import {
  isSetFilterModel,
  isDateFilterModel,
  isNumberFilterModel,
  isCombinedFilterModel,
  isFilterModel,
  isTextFilterModel,
} from '../crud-gen-type-checker.utils.js';
import {
  GeneralFilters,
  FilterType,
  Operators,
  SortDirection,
  RowDefaultValues,
} from '../crud-gen.enum.js';
import {
  CrudGenFilterNotSupportedError,
  CrudGenInvalidArgumentError,
  CrudGenInvalidOperatorError,
  CrudGenError,
  CrudGenFilterProhibited,
} from '../crud-gen.error.js';
import {
  applyJoinArguments,
  columnConversion,
  formatRawSelectionWithoutAlias,
  getDestinationFieldName,
  isSymbolic,
  objectToFieldMapper,
} from '../crud-gen.helpers.js';
import {
  FilterModel,
  ICombinedSimpleModel,
  ICombinedWhereModel,
  ISimpleFilterModel,
  DateFilterModel,
  ISetFilterModel,
  FilterInput,
  CrudGenFindManyOptions,
  ICrudGenBaseParams,
  ICrudGenArgsOptions,
  ISortModelStrict,
} from '../api-graphql/crud-gen-gql.interface.js';
import {
  findOperatorTypes,
  IWhereConditionType,
  IWhereCondition,
  IKeyMeta,
} from '../api-graphql/crud-gen-gql.type.js';
import { FilterOption, FilterOptionType } from '../object.decorator.js';

export function getTextFilter(filter: string, firstParameter: string) {
  switch (filter.toLowerCase()) {
    case GeneralFilters.EQUALS.toLowerCase():
      return Equal(firstParameter);
    //NOT_EQUAL should use the EQUALS condition, but the name is a little bit different
    case GeneralFilters.EQUAL.toLowerCase():
      return Equal(firstParameter);
    case GeneralFilters.STARTSWITH.toLowerCase():
      return Like(`${firstParameter}%`);
    case GeneralFilters.ENDSWITH.toLowerCase():
      return Like(`%${firstParameter}`);
    case GeneralFilters.CONTAINS.toLowerCase():
    case GeneralFilters.LIKE.toLowerCase():
      return Like(`%${firstParameter}%`);
    default:
      throw new CrudGenFilterNotSupportedError(`filter: ${filter} type: TEXT`);
  }
}

export function getNumberFilter(
  filter: string,
  firstParameter: number,
  secondParameter?: number,
): FindOperator<number> {
  switch (filter.toLowerCase()) {
    case GeneralFilters.EQUALS.toLowerCase():
      return Equal(firstParameter);
    case GeneralFilters.EQUAL.toLowerCase():
      return Equal(firstParameter);
    case GeneralFilters.LESSTHAN.toLowerCase():
      return LessThan(firstParameter);
    case GeneralFilters.LESSTHANOREQUAL.toLowerCase():
      return LessThanOrEqual(firstParameter);
    case GeneralFilters.GREATERTHAN.toLowerCase():
      return MoreThan(firstParameter);
    case GeneralFilters.GREATERTHANOREQUAL.toLowerCase():
      return MoreThanOrEqual(firstParameter);
    case GeneralFilters.INRANGE.toLowerCase():
      return Between(firstParameter, secondParameter) as FindOperator<number>;
    default:
      throw new CrudGenFilterNotSupportedError(
        `filter: ${filter} type: NUMBER`,
      );
  }
}

export function getDateFilter(
  filter: string,
  firstParameter: string,
  secondParameter?: string,
) {
  switch (filter.toLowerCase()) {
    case GeneralFilters.EQUALS.toLowerCase():
      return Equal(firstParameter);
    case GeneralFilters.EQUAL.toLowerCase():
      return Equal(firstParameter);
    case GeneralFilters.LESSTHAN.toLowerCase():
      return LessThan(firstParameter);
    case GeneralFilters.GREATERTHAN.toLowerCase():
      return MoreThan(firstParameter);
    case GeneralFilters.INRANGE.toLowerCase():
      return Between(firstParameter, secondParameter) as FindOperator<string>;
    case GeneralFilters.INDATE.toLowerCase(): {
      const dateFrom = new Date(firstParameter).setHours(0, 0, 0, 0);
      const dateTo = new Date(secondParameter ?? firstParameter).setHours(
        23,
        59,
        59,
        999,
      );
      return Between(
        DateHelper.dateToSQLDateTime(new Date(dateFrom)),
        DateHelper.dateToSQLDateTime(new Date(dateTo)),
      );
    }
    default:
      throw new CrudGenFilterNotSupportedError(`filter: ${filter} type: DATE`);
  }
}

export function filterSwitch(
  filter: FilterModel,
  filterName?: string,
): FindOperator<number | string | Date | null> {
  let arg1: findOperatorTypes = undefined;
  let arg2: findOperatorTypes = undefined;

  // handle SET before hand
  if (isSetFilterModel(filter)) {
    return In(filter.values);
  }

  if (isDateFilterModel(filter)) {
    arg1 = filter.dateFrom;
    arg2 = filter.dateTo;
  } else if (isNumberFilterModel(filter)) {
    arg1 = filter.filter;
    arg2 = filter.filterTo;
  } else {
    arg1 = filter.filter; // text filter model
  }

  if (arg1 === undefined) {
    throw new CrudGenInvalidArgumentError();
  }

  filterName = filterName ?? filter.type;

  return getFindOperator(filter.filterType, filterName, arg1, arg2);
}

export function getFindOperator(
  filterType: FilterType,
  filterName: string,
  arg1: any,
  arg2?: any,
): FindOperator<number | string | Date | null> {
  if (filterName.toLowerCase() === GeneralFilters.ISNULL.toLowerCase()) {
    return IsNull();
  }
  switch (filterType) {
    case FilterType.TEXT:
      return getTextFilter(filterName, <string>arg1);
    case FilterType.NUMBER:
      return getNumberFilter(filterName, <number>arg1, <number>arg2);
    case FilterType.DATE:
      return getDateFilter(filterName, <string>arg1, <string>arg2);
    case FilterType.SET:
      return In(arg1);
    default:
      throw new CrudGenFilterNotSupportedError(
        `filter: ${filterName} type: ${filterType}`,
      );
  }
}

export function convertFilter(
  filter: FilterModel | ICombinedSimpleModel,
): FindOperator<string | number | Date | null> | ICombinedWhereModel {
  if (isCombinedFilterModel(filter)) {
    if (
      filter.operator.toUpperCase() !== Operators.OR &&
      filter.operator.toUpperCase() !== Operators.AND
    ) {
      throw new CrudGenInvalidOperatorError();
    }
    return {
      operator: filter.operator,
      filter_1: convertFilter(filter.condition1),
      filter_2: convertFilter(filter.condition2),
    };
  }

  if (!isFilterModel(filter)) throw new CrudGenInvalidArgumentError();

  let filterToApply;
  if (
    !isSetFilterModel(filter) &&
    filter.type.startsWith('not') &&
    filter.type !== GeneralFilters.NOT
  ) {
    filterToApply = Not(filterSwitch(filter, filter.type.substring(3)));
  } else {
    filterToApply = filterSwitch(filter);
  }
  return filterToApply;
}

export function resolveFilter(
  filter:
    | ICombinedSimpleModel
    | ISimpleFilterModel
    | DateFilterModel
    | ISetFilterModel,
): IWhereConditionType {
  let filterToApply: FindOperator<findOperatorTypes> | ICombinedWhereModel;
  if (
    isTextFilterModel(filter) ||
    isNumberFilterModel(filter) ||
    isDateFilterModel(filter) ||
    isSetFilterModel(filter)
  ) {
    filterToApply = convertFilter(filter);
  } else {
    throw new CrudGenFilterNotSupportedError(`${JSON.stringify(filter)}`);
  }
  return filterToApply;
}

export function createWhere(
  filtersObject: FilterInput,
  fieldMapper: IFieldMapper | undefined,
  alias?: string,
  where: IWhereCondition = { filters: {} },
): IWhereCondition {
  if (!filtersObject) {
    return where;
  }

  const prefix = alias ? `${alias}.` : '';

  const filtersObjectCleared: FilterModel[] = [];

  if (filtersObject.expressions) {
    Object.values(filtersObject.expressions).map((field) => {
      const exprTypes = Object.keys(field);

      /**
       * Since union for input types are not possible yet, we need this check
       * @see https://github.com/graphql/graphql-spec/issues/488
       */
      if (exprTypes.length > 1) {
        throw new CrudGenError(
          `Field can't use more than one expression type on same expression: ${exprTypes}`,
        );
      }

      const exprType = exprTypes[0] as FilterType;

      const expr = field[exprType];

      if (!expr || !expr.field)
        throw new Error('Expression not found! It should never happen');

      const dbFieldName = columnConversion(expr.field, fieldMapper);

      const filterName = `${prefix}${dbFieldName}`;

      filtersObjectCleared.push({
        ...expr,
        field: filterName,
        filterType: exprType as any /**@todo fix type */,
      });
    });
  }

  where.operator = filtersObject.operator;

  // we skip the "filters" property of the first level and use the childExpressions
  // directly in order to be able processing conditions on same column name
  const childExpressions: IWhereCondition[] = where.childExpressions ?? [];
  for (const expr of filtersObjectCleared) {
    // for every property in the mapper or in the query we're checking if the relative filter exist
    const key = expr.field;

    if (isFilterModel(expr) || isCombinedFilterModel(expr)) {
      // after processing the filter, we take advantage of a function to perform all the necessary checks
      // and manage the filter cases based on the type of the filter itself
      childExpressions.push({
        filters: { [key]: resolveFilter(expr) },
      });
    } else {
      throw new CrudGenFilterNotSupportedError(`${JSON.stringify(expr)}`);
    }
  }

  if (filtersObject.childExpressions) {
    filtersObject.childExpressions.forEach((expr) =>
      childExpressions.push(createWhere(expr, fieldMapper)),
    );
  }

  where.childExpressions = childExpressions;

  return where;
}

export function removeSymbolicSelection(
  select: string[],
  data: IFieldMapper | undefined,
  path: string,
): string[] {
  for (let i = 0; i < select.length; i++) {
    if (isSymbolic(data, path + select[i])) {
      select.splice(i, 1);
      i--;
    }
  }
  return select;
}

export function checkFilterScope(
  where: IWhereCondition,
  filterOption: FilterOption,
) {
  for (const key of Object.keys(where.filters)) {
    if (
      !key.includes('.') &&
      filterOption.fields &&
      (filterOption.type === FilterOptionType.INCLUDE
        ? !filterOption.fields.includes(key)
        : filterOption.fields.includes(key))
    ) {
      throw new CrudGenFilterProhibited();
    }
  }
  const { childExpressions } = where;
  if (Array.isArray(childExpressions)) {
    childExpressions.forEach((expr) => checkFilterScope(expr, filterOption));
  }
}

export function mapCrudGenParam<Entity extends ObjectLiteral>(
  params: ICrudGenArgsOptions | undefined,
  select: { keys: string[]; keysMeta?: { [key: string]: IKeyMeta } },
  args: ICrudGenBaseParams,
  options: { isCount?: boolean } = {},
) {
  let filterOption: FilterOption | undefined;
  let fieldMapper: IFieldMapper = {};
  const fieldType = params?.fieldType ?? params?.fieldMap ?? params?.entityType;

  if (fieldType) {
    const fieldMapperAndFilter = objectToFieldMapper(fieldType);

    filterOption = fieldMapperAndFilter.filterOption;
    fieldMapper = fieldMapperAndFilter.field;
  }

  const defaultSorting = params?.defaultValue?.sorting;

  // MAP filter -> where
  const where = args.filters
    ? createWhere(args.filters, fieldMapper)
    : { filters: {} };

  if (filterOption) {
    checkFilterScope(where, filterOption);
  }

  // MAP sorting -> order
  const order: FindOptionsOrder<Entity> = mapSortingParamsToTypeORM(
    args.sorting ?? defaultSorting ?? [],
    (col: string | number | symbol) => {
      let colName = col.toString();
      if (fieldMapper[colName]?.mode === 'derived') {
        colName = formatRawSelectionWithoutAlias(
          getDestinationFieldName(fieldMapper[colName].dst),
          // fieldMapper[col]._propertyName ?? fieldMapper[col].dst,
        );
      } else {
        colName = columnConversion(colName, fieldMapper);
      }

      return colName;
    },
  );

  // MAP startRow/endRow -> take/skip
  const { take, skip } = mapPaginationParamsToTypeORM(
    args.startRow,
    args.endRow,
    params?.options?.maxRow,
  );

  const skipCount = !options.isCount;

  const findManyOptions: CrudGenFindManyOptions = {
    skip,
    take,
    order,
    select: select.keys,
    where,
    extra: {
      skipCount,
      _fieldMapper: fieldMapper,
      _keysMeta: select.keysMeta,
    },
  };

  if (params?.entityType && args.join) {
    applyJoinArguments(
      findManyOptions,
      params.entityType.name,
      args.join,
      fieldMapper,
    );
  }

  return findManyOptions;
}

export function mapPaginationParamsToTypeORM(
  startRow?: number,
  endRow?: number,
  maxRow?: number,
) {
  const max = maxRow ?? RowDefaultValues.MAX_ROW;
  const skip = startRow ?? RowDefaultValues.START_ROW;

  const checkMaxRow = (requestRow: number) => {
    if (max === 0 || requestRow < max) {
      return requestRow;
    } else {
      throw new CrudGenError(
        `Invalid max number of row selected: cannot exeed max ${max}`,
      );
    }
  };

  const numericEndRow =
    typeof endRow === 'number' && !Number.isNaN(endRow) ? endRow : undefined;
  const requested =
    typeof numericEndRow === 'number' ? numericEndRow - skip : undefined;

  const take = requested !== undefined ? checkMaxRow(requested) : max;

  return { skip, take };
}

export function mapSortingParamsToTypeORM<TInputType = any, TEntityType = any>(
  sorting: ISortModelStrict<TInputType>[],
  transform?: (col: keyof TInputType) => keyof TEntityType,
) {
  const order: FindOptionsOrder<TEntityType> = {};

  if (Array.isArray(sorting)) {
    sorting.forEach((sortParams) => {
      const col = sortParams.colId;
      const colName: keyof TEntityType = transform?.(col) ?? (col as any);

      const val = sortParams.sort?.toUpperCase();
      const sortDir: 'ASC' | 'DESC' = <SortDirection>val ?? 'ASC';
      /** @todo fix typehinting error when we remove 'as any' */
      order[colName] = sortDir as any;
    });
  }

  return order;
}
