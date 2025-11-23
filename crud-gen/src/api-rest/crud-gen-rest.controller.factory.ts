import {
  Controller,
  Get,
  Inject,
  Param,
  applyDecorators,
  UseInterceptors,
} from '@nestjs/common';
import type {
  CrudGenFindManyOptions,
  ICrudGenGqlArgsOptions,
} from '../api-graphql/crud-gen-gql.interface.js';
import { CGQueryArgs } from './crud-gen-args-rest.decorator.js';
import {
  buildCrudGenRestSimpleMapperInterceptor,
  CrudGenRestPaginationInterceptor,
} from './crud-gen-rest.interceptor.js';
import { GenericService, getServiceToken } from '../typeorm/generic.service.js';
import type { ClassType } from '@nestjs-yalc/types/globals.d.js';
import { yalcPlainToInstance } from '../transformers.helpers.js';
import { getProviderToken } from '../crud-gen.helpers.js';
import type { IDecoratorType } from '@nestjs-yalc/interfaces';

export interface CrudRestControllerOptions<Entity extends Record<string, any>> {
  entityModel: ClassType<Entity>;
  /**
   * DTO used to serialize output. Defaults to `entityModel`.
   */
  dto?: ClassType<any>;
  /**
   * Optional path override. Defaults to the entity name in kebab-case.
   */
  path?: string;
  /**
   * Token used to resolve the service. Defaults to `getServiceToken(entityModel)`.
   */
  serviceToken?: string | symbol;
  /**
   * Customize query args mapping (sorting, defaults, extra args...).
   */
  query?: ICrudGenGqlArgsOptions;
  /**
   * Field used for `GET :id`. Defaults to `id`.
   */
  idField?: keyof Entity & string;
  decorators?: IDecoratorType[];
}

const toKebabCase = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_+/g, '-')
    .toLowerCase();

export function crudRestControllerFactory<Entity extends Record<string, any>>(
  options: CrudRestControllerOptions<Entity>,
) {
  const {
    entityModel,
    dto = entityModel,
    path = toKebabCase(entityModel.name),
    serviceToken = getServiceToken(entityModel),
    query = { entityType: entityModel } as ICrudGenGqlArgsOptions,
    idField = 'id' as keyof Entity & string,
  } = options;

  @Controller(path)
  class CrudRestController {
    constructor(
      @Inject(getProviderToken(serviceToken))
      readonly service: GenericService<Entity>,
    ) {}

    @Get()
    @UseInterceptors(
      CrudGenRestPaginationInterceptor,
      buildCrudGenRestSimpleMapperInterceptor(dto, true),
    )
    async list(
      @CGQueryArgs(query) findOptions: CrudGenFindManyOptions<Entity>,
    ) {
      return this.service.getEntityListExtended(findOptions, true);
    }

    @Get(':id')
    @UseInterceptors(buildCrudGenRestSimpleMapperInterceptor(dto, false))
    async getById(@Param('id') id: string) {
      const entity = await this.service.getEntity(
        { [idField]: id } as any,
        undefined,
        undefined,
        undefined,
        { failOnNull: true },
      );
      return dto === entityModel ? entity : yalcPlainToInstance(dto, entity);
    }
  }

  if (options.decorators?.length) {
    applyDecorators(...options.decorators)(CrudRestController);
  }

  return CrudRestController;
}
