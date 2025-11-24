import { returnValue } from '@nestjs-yalc/utils/index.js';
import {
  applyDecorators,
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
import { Args } from '@nestjs/graphql';
import {
  ApiResponseOptions,
  ApiProperty,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ClassType } from 'nestjs-yalc';
import { IConnection } from '../crud-gen.interface.js';

export function mapCrudGenRestParams<Entity extends ObjectLiteral>(
  params: ICrudGenGqlArgsOptions | undefined,
  ctx: ExecutionContext,
): CrudGenFindManyOptions {
  const args: ICrudGenBaseParams = ctx.getArgs() as any;

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

      argDecorators.push(
        Args(argName, params.extraArgs[argName].options ?? {}),
      );
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
