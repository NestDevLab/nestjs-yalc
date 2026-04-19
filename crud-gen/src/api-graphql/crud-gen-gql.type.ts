import { ObjectType, Field, HideField } from '@nestjs/graphql';
import { Type } from '@nestjs/common';
import { FindManyOptions, FindOperator, ObjectLiteral } from 'typeorm';
import returnValue from '@nestjs-yalc/utils/returnValue.js';
import { IExtraArg, ICombinedWhereModel } from './crud-gen-gql.interface.js';
import { Operators } from '../crud-gen.enum.js';
import { FieldMapperProperty } from '@nestjs-yalc/interfaces';
import { IModelFieldMetadata } from '../object.decorator.js';
import { IConnection, IPageDataCrudGen } from '../crud-gen.interface.js';

@ObjectType()
export class PageDataCrudGenGql implements IPageDataCrudGen {
  @Field()
  public count!: number;

  @Field()
  public startRow!: number;

  @Field()
  public endRow!: number;
}

export interface IConnectionGql extends IConnection {
  pageData: PageDataCrudGenGql;
}

export const typeMap: {
  [key: string]: { new (name: string): IConnectionGql };
} = {};
export default function CrudGenGqlType<T>(type: Type<T>): any {
  const { name } = type;
  if (typeMap[`${name}`]) return typeMap[`${name}`];

  @ObjectType(`${name}Connection`, { isAbstract: true })
  class Connection implements IConnectionGql {
    @HideField() // internally used
    public name = `${name}Connection`;

    @Field(returnValue([type]), { nullable: true })
    public nodes!: T[];
    @Field(returnValue(PageDataCrudGenGql), { nullable: true })
    public pageData!: PageDataCrudGenGql;
  }
  typeMap[`${name}`] = Connection;

  return typeMap[`${name}`];
}

export type findOperatorTypes = string | number | Date | undefined | null;

export interface IGqlSelectedFields<T> {
  fields: (keyof T)[];
}

export interface ICrudGenArgs<T>
  extends FindManyOptions, IGqlSelectedFields<T> {}

export interface RecursiveFindOperator<T> {
  [index: number]: RecursiveFindOperator<T> | FindOperator<T>;
  length: number;
}

export interface RecursiveAndFindOperator<T> {
  condition_1?: RecursiveAndFindOperator<T> | FindOperator<T>;
  condition_2?: RecursiveAndFindOperator<T> | FindOperator<T>;
}

export type IWhereConditionType =
  | FindOperator<findOperatorTypes>
  | FindOperator<findOperatorTypes>[]
  | RecursiveFindOperator<findOperatorTypes>
  | RecursiveFindOperator<findOperatorTypes>[]
  | RecursiveAndFindOperator<findOperatorTypes>
  | RecursiveAndFindOperator<findOperatorTypes>[]
  | ICombinedWhereModel;

export type IWhereFilters<Entity extends ObjectLiteral> = Partial<{
  [key in keyof Entity]: IWhereConditionType;
}>;

export interface IWhereCondition<Entity extends ObjectLiteral = any> {
  operator?: Operators;
  filters: IWhereFilters<Entity>;
  childExpressions?: IWhereCondition<Entity>[];
}

export interface IFilterArg {
  key: string;
  value: findOperatorTypes;
  descriptors?: IExtraArg;
}

export interface ISelect {
  field: string;
  isRaw?: boolean;
  isNested?: boolean;
}

export interface IKeyMeta {
  fieldMapper: FieldMapperProperty | IModelFieldMetadata;
  isNested?: boolean;
  rawSelect: string;
}
