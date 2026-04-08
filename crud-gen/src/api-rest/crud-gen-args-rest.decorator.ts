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

function getRestQueryFromContext(ctx: ExecutionContext): Record<string, any> {
  const request = ctx.switchToHttp?.().getRequest?.();
  if (request?.query && typeof request.query === 'object') {
    return request.query as Record<string, any>;
  }

  // Fallback kept for lightweight unit tests that stub only `getArgs()`.
  const args = ctx.getArgs() as Record<string, any>;
  if (args && !Array.isArray(args)) {
    return args;
  }

  return {};
}

function parseStructuredRestParam<T>(
  value: unknown,
  name: 'sorting' | 'filters',
): T | undefined {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      throw new BadRequestException(
        `Invalid REST query parameter "${name}": expected valid JSON`,
      );
    }
  }

  return value as T;
}

function normalizeRestCrudGenArgs(
  rawQuery: Record<string, any>,
): ICrudGenBaseParams {
  const normalized: ICrudGenBaseParams = { ...rawQuery };

  if (typeof rawQuery.startRow !== 'undefined') {
    normalized.startRow = Number(rawQuery.startRow);
    if (Number.isNaN(normalized.startRow)) {
      throw new BadRequestException(
        'Invalid REST query parameter "startRow": expected a number',
      );
    }
  }

  if (typeof rawQuery.endRow !== 'undefined') {
    normalized.endRow = Number(rawQuery.endRow);
    if (Number.isNaN(normalized.endRow)) {
      throw new BadRequestException(
        'Invalid REST query parameter "endRow": expected a number',
      );
    }
  }

  normalized.sorting = parseStructuredRestParam(rawQuery.sorting, 'sorting');
  normalized.filters = parseStructuredRestParam(rawQuery.filters, 'filters');

  return normalized;
}

export function mapCrudGenRestParams<Entity extends ObjectLiteral>(
  params: ICrudGenGqlArgsOptions | undefined,
  ctx: ExecutionContext,
): CrudGenFindManyOptions {
  const args = normalizeRestCrudGenArgs(getRestQueryFromContext(ctx));

  const findParams = mapCrudGenParam<Entity>(
    params,
    { keys: [], keysMeta: {} },
    args,
    { isCount: true },
  );

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
