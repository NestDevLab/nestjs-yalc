import { returnValue } from '@nestjs-yalc/utils/index.js';
import {
  applyDecorators,
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
  Query,
} from '@nestjs/common';
import { ObjectLiteral } from 'typeorm';
import { mapCrudGenParam } from '../typeorm/crud-gen-args.helpers.js';
import {
  crudGenRestParamsFactory,
  crudGenRestParamsNoPaginationFactory,
  PageData,
} from './crud-gen-rest.dto.js';
import {
  CrudGenFindManyOptions,
  ICrudGenGqlArgsOptions,
  ICrudGenBaseParams,
} from '../api-graphql/crud-gen-gql.interface.js';
import {
  ApiResponseOptions,
  ApiProperty,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ClassType } from 'nestjs-yalc';
import { IConnection } from '../crud-gen.interface.js';
import { columnConversion, forceFilterWorker } from '../crud-gen.helpers.js';

function getRestQueryFromContext(
  ctx: ExecutionContext,
): Record<string, unknown> {
  const requestQuery = ctx.switchToHttp?.().getRequest?.()?.query;
  if (requestQuery && typeof requestQuery === 'object') {
    return requestQuery as Record<string, unknown>;
  }

  const args = ctx.getArgs?.() as unknown;
  if (args && typeof args === 'object' && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }

  return {};
}

function parseStructuredRestParam<T>(
  value: unknown,
  name: string,
): T | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  if (Array.isArray(value)) {
    throw new BadRequestException(
      `Query parameter "${name}" must be provided only once`,
    );
  }

  if (typeof value !== 'string') return value as T;

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new BadRequestException(`Invalid JSON query parameter "${name}"`);
  }
}

function parseRestNumberParam(
  value: unknown,
  name: string,
): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new BadRequestException(`Invalid numeric query parameter "${name}"`);
  }

  return parsed;
}

function normalizeRestCrudGenArgs(
  rawQuery: Record<string, unknown>,
): ICrudGenBaseParams {
  const args: ICrudGenBaseParams = { ...rawQuery };
  const startRow = parseRestNumberParam(rawQuery.startRow, 'startRow');
  const endRow = parseRestNumberParam(rawQuery.endRow, 'endRow');

  if (startRow !== undefined) args.startRow = startRow;
  if (endRow !== undefined) args.endRow = endRow;

  const sorting = parseStructuredRestParam<ICrudGenBaseParams['sorting']>(
    rawQuery.sorting,
    'sorting',
  );
  const filters = parseStructuredRestParam<ICrudGenBaseParams['filters']>(
    rawQuery.filters,
    'filters',
  );

  if (sorting !== undefined) args.sorting = sorting;
  if (filters !== undefined) args.filters = filters;

  return args;
}

export function mapCrudGenRestParams<Entity extends ObjectLiteral>(
  params: ICrudGenGqlArgsOptions | undefined,
  ctx: ExecutionContext,
): CrudGenFindManyOptions {
  const rawArgs = getRestQueryFromContext(ctx);
  const args = normalizeRestCrudGenArgs(rawArgs);

  const findParams = mapCrudGenParam<Entity>(
    params,
    { keys: [], keysMeta: {} },
    args,
    { isCount: true },
  );

  const fieldMapper = (findParams.extra as any)?._fieldMapper;
  const reservedKeys = new Set(['startRow', 'endRow', 'sorting', 'filters']);

  for (const [key, value] of Object.entries(rawArgs)) {
    if (
      reservedKeys.has(key) ||
      key.startsWith('$') ||
      value === undefined ||
      value === null ||
      Array.isArray(value) ||
      typeof value === 'object'
    ) {
      continue;
    }

    forceFilterWorker(
      (findParams.where ??= { filters: {} }),
      columnConversion(key, fieldMapper),
      value as string | number,
    );
  }

  return findParams;
}

export const CrudGenRestArgsFactory = <T extends ObjectLiteral>(
  data: ICrudGenGqlArgsOptions | undefined,
  ctx: ExecutionContext,
): CrudGenFindManyOptions<T> => {
  const params = mapCrudGenRestParams(data, ctx);

  return params;
};

export const CrudGenArgsMapper = createParamDecorator(CrudGenRestArgsFactory);

/**
 * Combine multiple param decorators
 */
export const CrudGenCombineDecorators = (params: ICrudGenGqlArgsOptions) => {
  const argDecorators: ParameterDecorator[] = [];
  if (params.extraArgs) {
    for (const argName of Object.keys(params.extraArgs)) {
      if (params.extraArgs[argName].hidden) continue;

      argDecorators.push(Query(argName));
    }
  }

  let joinArg: ParameterDecorator | undefined;
  /** @todo implement join */
  // if (params.entityType) {
  //   const JoinOptionInput = agJoinArgFactory(
  //     params.entityType,
  //     params.defaultValue,
  //   );

  //   if (JoinOptionInput) {
  //     joinArg = Query('join', {
  //       type:
  //         /*istanbul ignore next */
  //         () => JoinOptionInput,
  //       nullable: true,
  //     });
  //   }
  // }

  const args = Query();
  const mapper = CrudGenArgsMapper(params);
  return function (target: any, key: string, index: number) {
    args(target, key, index);
    joinArg && joinArg(target, key, index);
    argDecorators.map((d) => d(target, key, index));
    mapper(target, key, index);
  };
};

export const CGQueryArgs = (params: ICrudGenGqlArgsOptions) => {
  const gqlOptions = params.gql ?? {};

  gqlOptions.type = returnValue(
    crudGenRestParamsFactory(params.defaultValue, params.entityType),
  );

  params.gql = gqlOptions;

  return CrudGenCombineDecorators(params);
};

/**
 * Combine multiple param decorators
 */
export const CGQueryArgsNoPagination = (params: ICrudGenGqlArgsOptions) => {
  const gqlOptions = params.gql ?? {};
  if (!gqlOptions.type) {
    gqlOptions.type = returnValue(
      crudGenRestParamsNoPaginationFactory(
        params.defaultValue,
        params.entityType,
      ),
    );
  }

  params.gql = gqlOptions;

  return CrudGenCombineDecorators(params);
};

/**
 * Fix for swagger pagination with generic types
 * @see https://aalonso.dev/blog/how-to-generate-generics-dtos-with-nestjsswagger-422g
 */
export const ApiOkResponsePaginated = <DataDto extends ClassType = any>(
  dataDto: DataDto,
  options?: ApiResponseOptions,
) => {
  class ConnectionNode<T = any> implements IConnection<T> {
    public nodes!: T[];

    @ApiProperty()
    public pageData!: PageData;
  }

  return applyDecorators(
    ApiExtraModels(ConnectionNode, dataDto),
    ApiOkResponse({
      ...options,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ConnectionNode) },
          {
            properties: {
              nodes: {
                type: 'array',
                items: { $ref: getSchemaPath(dataDto) },
              },
            },
          },
        ],
      },
    }),
  );
};
