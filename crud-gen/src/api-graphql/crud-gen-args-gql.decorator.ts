import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Args, GqlExecutionContext } from '@nestjs/graphql';
import { ObjectLiteral } from 'typeorm';
import { GqlModelFieldsMapper } from '@nestjs-yalc/crud-gen/api-graphql/gqlfields.decorator.js';
import {
  crudGenParamsFactory,
  crudGenParamsNoPaginationFactory,
} from '../crud-gen.args.js';
import {
  CrudGenFindManyOptions,
  ICrudGenGqlArgsOptions,
  ICrudGenGqlArgsSingleOptions,
  ICrudGenBaseParams,
} from './crud-gen-gql.interface.js';
import {
  applyJoinArguments,
  forceFilters,
  objectToFieldMapper,
} from '../crud-gen.helpers.js';
import { agJoinArgFactory } from './crud-gen.input.js';
import returnValue from '@nestjs-yalc/utils/returnValue.js';
import { GraphQLResolveInfo } from 'graphql';
import { mapCrudGenParam } from '../typeorm/crud-gen-args.helpers.js';
import { ExtraArgsStrategy, GeneralFilters } from '../crud-gen.enum.js';
import {
  MissingArgumentsError,
  ArgumentsError,
} from '../missing-arguments.error.js';
import { IKeyMeta, IFilterArg } from './crud-gen-gql.type.js';
import { isAskingForCount } from './crud-gen-gql.helpers.js';

export function mapCrudGenGqlParams<Entity extends ObjectLiteral>(
  params: ICrudGenGqlArgsOptions | undefined,
  ctx: GqlExecutionContext,
  args: ICrudGenBaseParams,
  info: GraphQLResolveInfo,
): CrudGenFindManyOptions {
  const fieldType = params?.fieldType ?? params?.fieldMap ?? params?.entityType;
  // MAP query fields -> select
  const { keys, keysMeta } = GqlModelFieldsMapper(
    fieldType ?? {},
    ctx.getInfo(),
  );

  const findParams = mapCrudGenParamsGql<Entity>(
    params,
    ctx.getContext(),
    { keys, keysMeta },
    args,
    { isCount: isAskingForCount(info) },
  );

  findParams.info = info;

  return findParams;
}

export const CrudGenArgsFactory = <T extends ObjectLiteral>(
  data: ICrudGenGqlArgsOptions | undefined,
  ctx: ExecutionContext,
): CrudGenFindManyOptions<T> => {
  const gqlCtx = GqlExecutionContext.create(ctx);

  const params = mapCrudGenGqlParams(
    data,
    gqlCtx,
    gqlCtx.getArgs(),
    gqlCtx.getInfo(),
  );

  return params;
};

export const CrudGenArgsMapper = createParamDecorator(CrudGenArgsFactory);

/**
 * Combine multiple param decorators
 */
export const CrudGenCombineDecorators = (params: ICrudGenGqlArgsOptions) => {
  const argDecorators: ParameterDecorator[] = [];
  if (params.extraArgs) {
    for (const argName of Object.keys(params.extraArgs)) {
      if (params.extraArgs[argName].hidden) continue;

      argDecorators.push(
        Args(argName, params.extraArgs[argName].options ?? {}),
      );
    }
  }

  let joinArg: ParameterDecorator;
  if (params.entityType) {
    const JoinOptionInput = agJoinArgFactory(
      params.entityType,
      params.defaultValue,
    );

    if (JoinOptionInput) {
      joinArg = Args('join', {
        type:
          /*istanbul ignore next */
          () => JoinOptionInput,
        nullable: true,
      });
    }
  }

  const args = Args(params.gql ?? {});
  const mapper = CrudGenArgsMapper(params);
  return function (target: any, key: string, index: number) {
    args(target, key, index);
    joinArg && joinArg(target, key, index);
    argDecorators.map((d) => d(target, key, index));
    mapper(target, key, index);
  };
};

export const CrudGenArgs = (params: ICrudGenGqlArgsOptions) => {
  const gqlOptions = params.gql ?? {};
  if (!gqlOptions.type) {
    gqlOptions.type = returnValue(
      crudGenParamsFactory(params.defaultValue, params.entityType),
    );
  }

  params.gql = gqlOptions;

  return CrudGenCombineDecorators(params);
};

/**
 * Combine multiple param decorators
 */
export const CrudGenArgsNoPagination = (params: ICrudGenGqlArgsOptions) => {
  const gqlOptions = params.gql ?? {};
  if (!gqlOptions.type) {
    gqlOptions.type = returnValue(
      crudGenParamsNoPaginationFactory(params.defaultValue, params.entityType),
    );
  }

  params.gql = gqlOptions;

  return CrudGenCombineDecorators(params);
};

export function CrudGenArgsSingleDecoratorMapper<T extends ObjectLiteral>(
  params: ICrudGenGqlArgsOptions | undefined,
  args: ICrudGenBaseParams,
  info: GraphQLResolveInfo,
): CrudGenFindManyOptions<T> {
  const findManyOptions: CrudGenFindManyOptions = {};

  if (params) {
    const fieldType = params.fieldType ?? params.entityType;
    if (fieldType) {
      const fieldMapper = objectToFieldMapper(fieldType);

      const { keys, keysMeta } = GqlModelFieldsMapper(fieldType, info);
      findManyOptions.select = keys;
      findManyOptions.extra = {
        _keysMeta: keysMeta,
        _fieldMapper: fieldMapper.field,
      };

      if (params.entityType && args.join) {
        applyJoinArguments(
          findManyOptions,
          params.entityType.name,
          args.join,
          fieldMapper.field,
        );
      }
    }
  }

  return findManyOptions;
}

export const CrudGenArgsSingleDecoratorFactory = <T extends ObjectLiteral>(
  data: ICrudGenGqlArgsOptions | undefined,
  ctx: ExecutionContext,
): CrudGenFindManyOptions<T> => {
  const gqlCtx = GqlExecutionContext.create(ctx);

  return CrudGenArgsSingleDecoratorMapper<T>(
    data,
    gqlCtx.getArgs(),
    gqlCtx.getInfo(),
  );
};

export const CrudGenArgsSingleDecorator = createParamDecorator(
  CrudGenArgsSingleDecoratorFactory,
);

export const CrudGenArgsSingle = (params: ICrudGenGqlArgsSingleOptions) => {
  let joinArg: ParameterDecorator;
  if (params.entityType) {
    const JoinOptionInput = agJoinArgFactory(params.entityType);

    if (JoinOptionInput) {
      joinArg = Args('join', {
        type:
          /*istanbul ignore next */
          () => JoinOptionInput,
        nullable: true,
      });
    }
  }

  const mapper = CrudGenArgsSingleDecorator(params);
  return function (target: any, key: string, index: number) {
    joinArg && joinArg(target, key, index);
    mapper(target, key, index);
  };
};

export function mapCrudGenParamsGql<Entity extends ObjectLiteral>(
  params: ICrudGenGqlArgsOptions | undefined,
  ctx: ExecutionContext,
  select: { keys: string[]; keysMeta?: { [key: string]: IKeyMeta } },
  args: ICrudGenBaseParams,
  options: { isCount?: boolean } = {},
) {
  let findOptions = mapCrudGenParam<Entity>(params, select, args, options);

  const extraParameter: { [key: string]: any } = {};
  if (params?.extraArgs) {
    const extraArgsKeys = Object.keys(params.extraArgs);
    switch (params.extraArgsStrategy) {
      case ExtraArgsStrategy.AT_LEAST_ONE:
        if (
          args.length <= 0 ||
          extraArgsKeys.every((argName) => typeof args[argName] === 'undefined')
        )
          throw new MissingArgumentsError();
        break;
      case ExtraArgsStrategy.ONLY_ONE:
        if (
          extraArgsKeys.filter(
            (argName) => typeof args[argName] !== 'undefined',
          ).length > 1
        )
          throw new ArgumentsError('You must define only one extra arguments');
        break;
      case ExtraArgsStrategy.DEFAULT:
      default:
      // nothing to do
    }

    const forcedFilters: IFilterArg[] = [];
    for (const argName of Object.keys(params.extraArgs)) {
      if (
        params.extraArgs[argName].filterCondition === GeneralFilters.VIRTUAL
      ) {
        extraParameter[argName] = args[argName];
        continue;
      }

      let value = args[argName];
      const filterMiddleware = params.extraArgs[argName].filterMiddleware;

      if (filterMiddleware) {
        value = filterMiddleware(ctx, value);
      }

      forcedFilters.push({
        key: argName, // the column name mapping is executed internally
        value,
        descriptors: params.extraArgs[argName],
      });
    }

    findOptions.where = forceFilters(
      findOptions.where,
      forcedFilters,
      findOptions.extra?._fieldMapper,
    );
  }

  findOptions = {
    ...findOptions,
    extra: {
      ...findOptions.extra,
      args: extraParameter,
    },
  };

  return findOptions;
}

// Legacy helper used by existing tests (compatible signature)
export function mapCrudGenParams<Entity extends ObjectLiteral>(
  params: ICrudGenGqlArgsOptions | undefined,
  ctx: GqlExecutionContext | ExecutionContext,
  args: ICrudGenBaseParams,
  info: GraphQLResolveInfo,
) {
  const fieldType =
    params?.fieldType ?? params?.fieldMap ?? params?.entityType ?? {};

  let mappedFields: { keys: string[]; keysMeta?: { [key: string]: IKeyMeta } };
  try {
    mappedFields = GqlModelFieldsMapper(fieldType, info);
  } catch {
    mappedFields = { keys: [], keysMeta: {} };
  }

  return mapCrudGenParamsGql<Entity>(
    params,
    ctx as ExecutionContext,
    mappedFields,
    args,
    { isCount: isAskingForCount(info) },
  );
}

export {
  getTextFilter,
  getNumberFilter,
  getDateFilter,
  filterSwitch,
  resolveFilter,
  convertFilter,
  createWhere,
  removeSymbolicSelection,
  checkFilterScope,
  getFindOperator,
} from '../typeorm/crud-gen-args.helpers.js';
