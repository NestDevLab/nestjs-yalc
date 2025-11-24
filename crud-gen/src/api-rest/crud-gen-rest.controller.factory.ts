import {
  Controller,
  Get,
  Inject,
  Param,
  applyDecorators,
  UseInterceptors,
  Post,
  Put,
  Delete,
  Body,
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

export interface CrudRestMutationOptions {
  disabled?: boolean;
  decorators?: IDecoratorType[];
}

export interface CrudRestMutationsOptions {
  create?: CrudRestMutationOptions;
  update?: CrudRestMutationOptions;
  delete?: CrudRestMutationOptions;
}

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
  /**
   * When true, only read endpoints are generated (GET list + GET :id).
   * Write endpoints (POST/PUT/DELETE) are omitted.
   */
  readonly?: boolean;
  /**
   * Fine-grained control over write endpoints.
   * If `readonly` is true these are ignored.
   */
  mutations?: CrudRestMutationsOptions;
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
    readonly: isReadonly = false,
    mutations,
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

    /**
     * Create a new resource.
     * The request body is treated as a partial Entity payload.
     */
    async create(@Body() body: Partial<Entity>) {
      return this.service.createEntity(body as any);
    }

    /**
     * Update an existing resource by idField.
     */
    async update(id: string, @Body() body: Partial<Entity>) {
      return this.service.updateEntity({ [idField]: id } as any, body as any);
    }

    /**
     * Delete an existing resource by idField.
     */
    async remove(id: string) {
      await this.service.deleteEntity({ [idField]: id } as any);
      return { deleted: true };
    }
  }

  if (options.decorators?.length) {
    applyDecorators(...options.decorators)(CrudRestController);
  }

  /**
   * Attach write endpoints dynamically so that they can be disabled
   * via `readonly`/`mutations` options without affecting read routes.
   */
  if (!isReadonly) {
    const proto = CrudRestController.prototype;

    const createDescriptor = Object.getOwnPropertyDescriptor(proto, 'create');
    if (!createDescriptor)
      throw new ReferenceError(
        'CrudRestController.create must have a descriptor',
      );

    if (!mutations?.create?.disabled) {
      applyDecorators(
        Post(),
        UseInterceptors(buildCrudGenRestSimpleMapperInterceptor(dto, false)),
        ...(mutations?.create?.decorators ?? []),
      )(proto, 'create', createDescriptor);
    }

    const updateDescriptor = Object.getOwnPropertyDescriptor(proto, 'update');
    if (!updateDescriptor)
      throw new ReferenceError(
        'CrudRestController.update must have a descriptor',
      );

    if (!mutations?.update?.disabled) {
      applyDecorators(
        Put(':id'),
        UseInterceptors(buildCrudGenRestSimpleMapperInterceptor(dto, false)),
        ...(mutations?.update?.decorators ?? []),
      )(proto, 'update', updateDescriptor);

      Param('id')(proto, 'update', 0);
    }

    const removeDescriptor = Object.getOwnPropertyDescriptor(proto, 'remove');
    if (!removeDescriptor)
      throw new ReferenceError(
        'CrudRestController.remove must have a descriptor',
      );

    if (!mutations?.delete?.disabled) {
      applyDecorators(Delete(':id'), ...(mutations?.delete?.decorators ?? []))(
        proto,
        'remove',
        removeDescriptor,
      );

      Param('id')(proto, 'remove', 0);
    }
  }

  return CrudRestController;
}
