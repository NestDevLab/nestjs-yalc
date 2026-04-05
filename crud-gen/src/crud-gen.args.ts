import { ArgsType, Field } from '@nestjs/graphql';
import {
  filterExpressionInputFactory,
  SortModel,
  sortModelFactory,
} from './api-graphql/crud-gen.input.js';
import { FilterScalar } from './filter.scalar.js';
import returnValue from '@nestjs-yalc/utils/returnValue.js';
import { ClassType } from '@nestjs-yalc/types/globals.d.js';
import { RowDefaultValues } from './crud-gen.enum.js';
import { ICrudGenBaseParams } from './api-graphql/crud-gen-gql.interface.js';

export const typeMap = new WeakMap();
export function crudGenParamsFactory(
  defaultValues?: ICrudGenBaseParams,
  entityModel?: ClassType,
): { new (): ICrudGenBaseParams } {
  const SortType = entityModel ? [sortModelFactory(entityModel)] : [SortModel];
  const FilterType = entityModel
    ? filterExpressionInputFactory(entityModel)
    : FilterScalar;

  @ArgsType()
  class CrudGenParams implements ICrudGenBaseParams {
    @Field(() => Number, {
      nullable: true,
      defaultValue: defaultValues?.startRow ?? RowDefaultValues.START_ROW,
    })
    startRow: number = defaultValues?.startRow ?? RowDefaultValues.START_ROW;

    @Field(() => Number, {
      nullable: true,
      defaultValue: defaultValues?.endRow ?? RowDefaultValues.END_ROW,
    })
    endRow: number = defaultValues?.endRow ?? RowDefaultValues.END_ROW;
    @Field(returnValue(SortType), {
      nullable: true,
      defaultValue: defaultValues?.sorting,
    })
    sorting?: typeof SortType;
    @Field(returnValue(FilterType), {
      nullable: true,
      defaultValue: defaultValues?.filters,
    })
    filters?: typeof FilterType;
  }

  typeMap.set(CrudGenParams, CrudGenParams);
  return typeMap.get(CrudGenParams);
}

export function crudGenParamsNoPaginationFactory(
  defaultValues?: ICrudGenBaseParams,
  entityModel?: ClassType,
): { new (): ICrudGenBaseParams } {
  const SortType = entityModel ? [sortModelFactory(entityModel)] : [SortModel];
  const FilterType = entityModel
    ? filterExpressionInputFactory(entityModel)
    : FilterScalar;

  @ArgsType()
  class CrudGenParams implements ICrudGenBaseParams {
    @Field(returnValue(SortType), {
      nullable: true,
      defaultValue: defaultValues?.sorting,
    })
    sorting?: typeof SortType;
    @Field(returnValue(FilterType), {
      nullable: true,
      defaultValue: defaultValues?.filters,
    })
    filters?: typeof FilterType;
  }

  typeMap.set(CrudGenParams, CrudGenParams);
  return typeMap.get(CrudGenParams);
}
