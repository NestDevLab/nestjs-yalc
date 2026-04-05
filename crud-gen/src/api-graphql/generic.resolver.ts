// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - TODO: FIX THIS

import {
  Args,
  ArgsOptions,
  GqlExecutionContext,
  MutationOptions,
  Parent,
  Query,
  QueryOptions,
  ResolveField,
  Resolver,
  ReturnTypeFunc,
} from '@nestjs/graphql';
import {
  CrudGenArgs,
  CrudGenArgsSingle,
} from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-args-gql.decorator.js';

import {
  applyDecorators,
  ExecutionContext,
  Inject,
  UseInterceptors,
} from '@nestjs/common';
import { CrudGenGqlInterceptor } from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interceptor.js';
import returnValue from '@nestjs-yalc/utils/returnValue.js';
import {
  IExtraArg,
  CrudGenFindManyOptions,
  IIDArg,
} from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interface.js';
import {
  GenericService,
  getServiceToken,
} from '@nestjs-yalc/crud-gen/typeorm/generic.service.js';
import { IDecoratorType, IFieldMapper } from '@nestjs-yalc/interfaces';
import CrudGenGqlType from './crud-gen-gql.type.js';
import {
  getDataloaderToken,
  GQLDataLoader,
} from '@nestjs-yalc/data-loader/dataloader.helper.js';
import { ContextId, ContextIdFactory, ModuleRef } from '@nestjs/core';
import { Mutation } from '@nestjs/graphql';
import { ClassType } from '@nestjs-yalc/types/globals.d.js';
import {
  filterTypeToNativeType,
  getEntityRelations,
  IRelationInfo,
} from '../crud-gen.helpers.js';
import { getModelFieldMetadataList } from '../object.decorator.js';
import { CrudGenError } from '../crud-gen.error.js';
import { ExtraArgsStrategy } from '../crud-gen.enum.js';
import { ICrudGenParams } from '../crud-gen.args.js';
import { InputArgs } from '@nestjs-yalc/crud-gen/api-graphql/gqlmapper.decorator.js';
import { isClass } from '@nestjs-yalc/utils/class.helper.js';
import { GetContext } from '@nestjs-yalc/utils/nestjs/nest.decorator.js';
export interface IGenericResolver {
  [index: string]: any; //index signature
}

export interface IGenericResolverMethodOptions {
  disabled?: boolean;
  queryParams?: QueryOptions | MutationOptions;
  returnType?: ReturnTypeFunc;
  /**
   * @deprecated please use the property decorator alternative instead
   */
  fieldMap?: IFieldMapper;
  decorators?: IDecoratorType[];
  defaultValue?: ICrudGenParams;
  /**
   * Filters with direct arguments
   */
  extraArgsStrategy?: ExtraArgsStrategy;
  extraArgs?: {
    [index: string]: IExtraArg;
  };
}
export interface IExtraInput<Type> {
  middleware?: {
    (ctx: GqlExecutionContext, input: Type, filterValue?: any): any;
  };
  gqlOptions?: ArgsOptions;
}
export interface IExtraInputStrict<Type> {
  middleware: {
    (ctx: GqlExecutionContext, input: Type, filterValue?: any): any;
  };
  gqlOptions?: ArgsOptions;
}
/**
 * @property idName - if `not undefined` will be used as a key,
 * and the guid as value in the input object
 */
export interface IGenericResolverMutationCreateOptions<Type>
  extends IGenericResolverMethodOptions {
  extraInputs?: { [key: string]: IExtraInput<Type> };
}

/**
 * @property idName - if `undefined` will be used ID as value,
 *  if the type is IIDArg the guid will be used as id
 */
export interface IGenericResolverQueryOptions
  extends IGenericResolverMethodOptions {
  idName?: string | IIDArg;
  throwOnNotFound?: boolean;
}

export function isIDArg(arg: string | IIDArg): arg is IIDArg {
  return !!(<IIDArg>arg).name;
}

export function isExtraInputStrict<Entity>(
  input: undefined | IExtraInput<Entity>,
): input is IExtraInputStrict<Entity> {
  const casted = input as IExtraInputStrict<Entity>;
  return !!casted.middleware;
}

export function checkFinalId(finalId: string | undefined) {
  if (typeof finalId === 'undefined') {
    throw new Error("Can't have an undefined ID");
  }
}
// export interface ICustomQueryOptions extends IGenericResolverMethodOptions {
//   /**
//    * Filters with direct arguments
//    */
//   extraArgsStrategy?: ExtraArgsStrategy;
//   extraArgs?: {
//     [index: string]: IExtraArg;
//   };
// }

export interface ICustomSingleQueryOptions
  extends IGenericResolverMethodOptions {
  isSingleResource: true;
  throwOnNotFound?: boolean;
  idName?: string;
}

export function isCustomSingleQueryOptions(
  option: IGenericResolverQueryOptions | ICustomSingleQueryOptions,
): option is ICustomSingleQueryOptions {
  return (<ICustomSingleQueryOptions>option).isSingleResource === true;
}

export function hasExtraArgs(option: IGenericResolverQueryOptions): boolean {
  return !!(<IGenericResolverQueryOptions>option).extraArgs;
}

export function hasFilters(findOptions: CrudGenFindManyOptions) {
  return (
    (findOptions.where &&
      Object.values(findOptions.where.filters).length > 0) ||
    (findOptions.order && Object.values(findOptions.order).length > 0)
  );
}

export interface IGenericResolverOptions<Entity> {
  entityModel: ClassType<Entity>;
  dto?: ClassType;
  input?: {
    create?: ClassType;
    update?: ClassType;
    conditions?: ClassType;
  };
  prefix?: string;
  queries?: {
    getResource?: IGenericResolverQueryOptions;
    getResourceGrid?: IGenericResolverMethodOptions;
  };
  customQueries?: {
    [index: string]: IGenericResolverQueryOptions | ICustomSingleQueryOptions;
  };
  mutations?: {
    createResource: IGenericResolverMutationCreateOptions<Entity>;
    deleteResource: IGenericResolverMethodOptions;
    updateResource: IGenericResolverMethodOptions;
  };
  /** exclude create/delete/update mutations automatically */
  readonly?: boolean;
  /**
   * Override default service. It requires both service and the related dataloader
   */
  service?: {
    /**
     * Override default dataloader (must be based on class GQLDataLoader)
     */
    dataLoaderToken?: string;
    /**
     * Override default service (must be based on class GenericService)
     */
    serviceToken?: string;
  };
}

export function generateDecorators(
  methodFn: typeof Query | typeof Mutation,
  defaultName: string,
  typeFunc: ReturnTypeFunc,
  options?: IGenericResolverMethodOptions,
) {
  if (options?.disabled) return [];

  return [
    ...(options?.decorators ?? []),
    methodFn(typeFunc, {
      ...options?.queryParams,
      name: options?.queryParams?.name ?? defaultName,
    }),
  ];
}
export function defineFieldResolver<Entity extends Record<string, any> = any>(
  resolverInfoList: IRelationInfo[],
  resolver: ClassType<IGenericResolver>,
) {
  for (const resolverInfo of resolverInfoList) {
    let relType =
      (typeof resolverInfo.relation.type === 'function'
        ? resolverInfo.relation.type()
        : resolverInfo.relation.type) ?? resolverInfo.agField?.gqlType?.();

    if (Array.isArray(relType)) {
      relType = relType[0];
    } else if (!relType) {
      throw new CrudGenError('relation type undefined');
    }

    if (
      resolverInfo.relation.relationType === 'one-to-many' ||
      resolverInfo.relation.relationType === 'many-to-many'
    ) {
      const agGraphType = resolverInfo.agField?.gqlType?.();
      const isArrayGraphType = Array.isArray(agGraphType);

      Object.defineProperty(
        resolver.prototype,
        resolverInfo.relation.propertyName,
        {
          configurable: true,
          enumerable: true,
          writable: true,
          value: async function (
            parent: Entity,
            findOptions: CrudGenFindManyOptions,
          ): Promise<[Array<Entity | null>, number] | Array<Entity | null>> {
            const parentRes = parent[resolverInfo.relation.propertyName];

            if (parentRes !== undefined) {
              if (hasFilters(findOptions))
                throw new CrudGenError(
                  'Cannot specify join arguments and resolver arguments at the same time',
                );

              return isArrayGraphType ? parentRes : [parentRes, -1];
            }

            const dataLoader: GQLDataLoader<Entity> =
              await this.moduleRef.resolve(
                getDataloaderToken(relType),
                this.contextId,
              );

            const joinCol =
              resolverInfo.agField?.relation?.targetKey.alias ??
              resolverInfo.join?.referencedColumnName ??
              dataLoader.getSearchKey();

            const parentCol =
              resolverInfo.agField?.relation?.sourceKey.alias ??
              resolverInfo.join?.name ??
              dataLoader.getSearchKey();

            const result = await dataLoader.loadOneToMany(
              [joinCol, parent[parentCol]],
              findOptions,
              true,
            );

            return isArrayGraphType ? result[0] : result;
          },
        },
      );

      const descriptor = Object.getOwnPropertyDescriptor(
        resolver.prototype,
        resolverInfo.relation.propertyName,
      );

      if (!descriptor)
        throw new ReferenceError(
          `GenericResolver.${resolverInfo.relation.propertyName} must have a descriptor`,
        );

      ResolveField(
        returnValue(
          isArrayGraphType ? agGraphType : CrudGenGqlType<Entity>(relType),
        ),
        {
          nullable: resolverInfo.agField?.gqlOptions?.nullable,
        },
      )(resolver.prototype, resolverInfo.relation.propertyName, descriptor);
      UseInterceptors(new CrudGenGqlInterceptor())(
        resolver.prototype,
        resolverInfo.relation.propertyName,
        descriptor,
      );

      Parent()(resolver.prototype, resolverInfo.relation.propertyName, 0);

      CrudGenArgs({
        fieldType: relType,
        entityType: relType,
        defaultValue: resolverInfo.agField?.relation?.defaultValue,
      })(resolver.prototype, resolverInfo.relation.propertyName, 1);

      // without the design:paramtypes metadata
      // it won't work, the following instruction is transpiled and generated
      // when the decorators are defined in their standard way.
      Reflect.metadata('design:paramtypes', [Object, Object])(
        resolver.prototype,
        resolverInfo.relation.propertyName,
      );
    } else {
      /**
       * ONE-TO-ONE Resolve Fields
       */

      Object.defineProperty(
        resolver.prototype,
        resolverInfo.relation.propertyName,
        {
          configurable: true,
          enumerable: true,
          writable: true,
          value: async function (
            parent: Entity,
            findOptions: CrudGenFindManyOptions,
          ): Promise<Entity | null> {
            const parentRes = parent[resolverInfo.relation.propertyName];

            if (parentRes !== undefined) {
              if (hasFilters(findOptions))
                throw new CrudGenError(
                  'Cannot specify join arguments and resolver arguments at the same time',
                );

              return parentRes;
            }

            const dataLoader: GQLDataLoader<Entity> =
              await this.moduleRef.resolve(
                getDataloaderToken(relType),
                this.contextId,
              );

            /* istanbul ignore next */
            const joinCol =
              resolverInfo.agField?.relation?.targetKey.alias ??
              resolverInfo.join?.referencedColumnName ??
              dataLoader.getSearchKey();

            const parentCol =
              resolverInfo.agField?.relation?.sourceKey.alias ??
              resolverInfo.join?.name ??
              dataLoader.getSearchKey();
            return dataLoader.loadOne(
              [joinCol, parent[parentCol]],
              findOptions,
              false,
            );
          },
        },
      );

      const descriptor = Object.getOwnPropertyDescriptor(
        resolver.prototype,
        resolverInfo.relation.propertyName,
      );

      if (!descriptor)
        throw new ReferenceError(
          `GenericResolver.${resolverInfo.relation.propertyName} must have a descriptor`,
        );

      ResolveField(returnValue(relType), {
        nullable: resolverInfo.agField?.gqlOptions?.nullable,
      })(resolver.prototype, resolverInfo.relation.propertyName, descriptor);

      Parent()(resolver.prototype, resolverInfo.relation.propertyName, 0);

      CrudGenArgsSingle({ fieldType: relType, entityType: relType })(
        resolver.prototype,
        resolverInfo.relation.propertyName,
        1,
      );

      // without the design:paramtypes metadata
      // it won't work, the following instruction is transpiled and generated
      // when the decorators are defined in their standard way.
      Reflect.metadata('design:paramtypes', [Object, Array])(
        resolver.prototype,
        resolverInfo.relation.propertyName,
      );
    }
  }
}

export function defineGetSingleResource<Entity>(
  queryName: string,
  returnType: ClassType,
  resolver: ClassType<IGenericResolver>,
  methodOptions: IGenericResolverQueryOptions,
) {
  Object.defineProperty(resolver.prototype, queryName, {
    configurable: true,
    writable: true,
    value: async function (
      findOptions: CrudGenFindManyOptions<Entity>,
      ctx: ExecutionContext,
      id?: string,
    ): Promise<Entity | null> {
      const dataLoader: GQLDataLoader<Entity> = this.dataLoader;

      let finalId;
      if (methodOptions.idName && isIDArg(methodOptions.idName)) {
        finalId = methodOptions.idName.filterMiddleware
          ? methodOptions.idName.filterMiddleware(ctx, id)
          : id;
      } else {
        finalId = id;
      }

      checkFinalId(finalId);

      return dataLoader.loadOne(
        [dataLoader.getSearchKey(), finalId],
        findOptions,
        methodOptions.throwOnNotFound ?? false,
      );
    },
  });

  const descriptor = Object.getOwnPropertyDescriptor(
    resolver.prototype,
    queryName,
  );

  if (!descriptor)
    throw new ReferenceError(
      `${resolver.name}.${queryName} must have a descriptor`,
    );

  applyDecorators(
    ...generateDecorators(
      Query,
      queryName,
      methodOptions.returnType ?? returnValue(returnType),
      methodOptions,
    ),
  )(resolver.prototype, queryName, descriptor);

  const fieldType = methodOptions.returnType?.() ?? returnType;

  const entityType =
    !isClass(fieldType) && typeof fieldType === 'function'
      ? fieldType()
      : fieldType;

  CrudGenArgsSingle({
    fieldType,
    entityType,
  })(resolver.prototype, queryName, 0);

  GetContext()(resolver.prototype, queryName, 1);

  if (methodOptions.idName && isIDArg(methodOptions.idName)) {
    if (!methodOptions.idName.hidden) {
      Args(methodOptions.idName.name, {
        nullable: false,
        type: returnValue(String),
      })(resolver.prototype, queryName, 2);
    }
  } else {
    Args(methodOptions.idName ?? 'ID', {
      nullable: false,
      type: returnValue(String),
    })(resolver.prototype, queryName, 2);
  }

  Reflect.metadata('design:paramtypes', [Object, Array])(
    resolver.prototype,
    queryName,
  );
}

export function defineGetGridResource<Entity>(
  queryName: string,
  returnType: ClassType,
  resolver: ClassType<IGenericResolver>,
  methodOptions: IGenericResolverQueryOptions,
) {
  Object.defineProperty(resolver.prototype, queryName, {
    configurable: true,
    writable: true,
    value: async function (
      findOptions: CrudGenFindManyOptions,
    ): Promise<[Entity[], number]> {
      return (<GenericService<Entity>>this.service).getEntityListExtended(
        findOptions,
        true,
      );
    },
  });

  const descriptor = Object.getOwnPropertyDescriptor(
    resolver.prototype,
    queryName,
  );

  if (!descriptor)
    throw new ReferenceError(
      `${resolver.name}.${queryName} must have a descriptor`,
    );

  applyDecorators(
    ...generateDecorators(
      Query,
      queryName,
      methodOptions.returnType ??
        returnValue(CrudGenGqlType<Entity>(returnType)),
      methodOptions,
    ),
  )(resolver.prototype, queryName, descriptor);

  UseInterceptors(new CrudGenGqlInterceptor())(
    resolver.prototype,
    queryName,
    descriptor,
  );

  const fieldType = methodOptions.returnType?.() ?? returnType;
  const entityType =
    !isClass(fieldType) && typeof fieldType === 'function'
      ? fieldType()
      : fieldType;

  const extraArgTypes: any[] = [];
  if (hasExtraArgs(methodOptions)) {
    CrudGenArgs({
      fieldType,
      entityType,
      extraArgs: methodOptions.extraArgs,
      extraArgsStrategy: methodOptions.extraArgsStrategy,
      // type: returnValue(crudGenParamsFactory(methodOptions.defaultValue)),
    })(resolver.prototype, queryName, 0);

    if (methodOptions.extraArgs) {
      Object.values(methodOptions.extraArgs).map((a) => {
        if (!a.hidden) extraArgTypes.push(filterTypeToNativeType(a.filterType));
      });
    }
  } else {
    CrudGenArgs({
      fieldType,
      entityType,
    })(resolver.prototype, queryName, 0);
  }

  Reflect.metadata('design:paramtypes', [Object])(
    resolver.prototype,
    queryName,
  );
}

export function defineCreateMutation<Entity>(
  queryName: string,
  returnType: ClassType,
  resolver: ClassType<IGenericResolver>,
  options: IGenericResolverOptions<Entity>,
  methodOptions: IGenericResolverMutationCreateOptions<Entity>,
) {
  const extraInputs = methodOptions.extraInputs;

  Object.defineProperty(resolver.prototype, queryName, {
    configurable: true,
    writable: true,
    value: async function (
      input: Entity,
      findOptions: CrudGenFindManyOptions<Entity>,
      ctx: ExecutionContext,
      extraInputsArgs?: { [key: string]: IExtraInput<Entity> },
    ): Promise<Entity | null> {
      const gqlCtx = GqlExecutionContext.create(ctx);

      if (extraInputs)
        Object.keys(extraInputs).forEach((k) => {
          const extraInputObj = extraInputs[k];
          if (isExtraInputStrict<Entity>(extraInputObj)) {
            if (!extraInputsArgs) {
              extraInputsArgs = {};
            }

            extraInputsArgs[k] = extraInputObj.middleware(
              gqlCtx,
              input,
              extraInputsArgs[k],
            );
          }
        });

      return (<GenericService<Entity>>this.service).createEntity(
        input,
        findOptions,
      );
    },
  });

  const descriptor = Object.getOwnPropertyDescriptor(
    resolver.prototype,
    queryName,
  );

  if (!descriptor)
    throw new ReferenceError(
      `${resolver.name}.${queryName} must have a descriptor`,
    );

  applyDecorators(
    ...generateDecorators(
      Mutation,
      queryName,
      methodOptions.returnType ?? returnValue(returnType),
      methodOptions,
    ),
  )(resolver.prototype, queryName, descriptor);

  InputArgs({
    gql: {
      type:
        /* istanbul ignore next */
        () => options.input?.create ?? returnType,
    },
    fieldType: options.input?.create ?? returnType,
    _name: 'input',
  })(resolver.prototype, queryName, 0);

  const fieldType = methodOptions.returnType?.() ?? returnType;
  const entityType =
    !isClass(fieldType) && typeof fieldType === 'function'
      ? fieldType()
      : fieldType;

  CrudGenArgsSingle({
    fieldType,
    entityType,
  })(resolver.prototype, queryName, 1);

  GetContext()(resolver.prototype, queryName, 2);

  if (extraInputs) {
    Object.keys(extraInputs).forEach((k, i) => {
      const extraInputObj = extraInputs[k];

      if (!extraInputObj.gqlOptions) return;

      InputArgs({
        gql: extraInputObj.gqlOptions,
        fieldType: extraInputObj.gqlOptions.type,
        _name: k,
      })(resolver.prototype, queryName, 3 + i);
    });
  }

  Reflect.metadata('design:paramtypes', [Object])(
    resolver.prototype,
    queryName,
  );
}

export function defineUpdateMutation<Entity>(
  queryName: string,
  returnType: ClassType,
  resolver: ClassType<IGenericResolver>,
  options: IGenericResolverOptions<Entity>,
  methodOptions: IGenericResolverQueryOptions,
) {
  Object.defineProperty(resolver.prototype, queryName, {
    configurable: true,
    writable: true,
    value: async function (
      conditions: Entity,
      input: Entity,
      findOptions: CrudGenFindManyOptions<Entity>,
    ): Promise<Entity | null> {
      return (<GenericService<Entity>>this.service).updateEntity(
        conditions,
        input,
        findOptions,
      );
    },
  });

  const descriptor = Object.getOwnPropertyDescriptor(
    resolver.prototype,
    queryName,
  );

  if (!descriptor)
    throw new ReferenceError(
      `${resolver.name}.${queryName} must have a descriptor`,
    );

  applyDecorators(
    ...generateDecorators(
      Mutation,
      `${options.prefix ?? ''}update${options.entityModel.name}`,
      methodOptions.returnType ?? returnValue(returnType),
      methodOptions,
    ),
  )(resolver.prototype, queryName, descriptor);

  InputArgs({
    fieldType: options.input?.conditions ?? returnType,
    gql: {
      type:
        /* istanbul ignore next */
        () => options.input?.conditions ?? returnType,
    },
    _name: 'conditions',
  })(resolver.prototype, queryName, 0);

  InputArgs({
    fieldType: options.input?.update ?? returnType,
    gql: {
      type:
        /* istanbul ignore next */
        () => options.input?.update ?? returnType,
    },
    _name: 'input',
  })(resolver.prototype, queryName, 1);

  const fieldType = methodOptions.returnType?.() ?? returnType;
  const entityType =
    !isClass(fieldType) && typeof fieldType === 'function'
      ? fieldType()
      : fieldType;

  CrudGenArgsSingle({
    fieldType,
    entityType,
  })(resolver.prototype, queryName, 2);

  Reflect.metadata('design:paramtypes', [Object, Object])(
    resolver.prototype,
    queryName,
  );
}

export function defineDeleteMutation<Entity>(
  queryName: string,
  returnType: ClassType,
  resolver: ClassType<IGenericResolver>,
  options: IGenericResolverOptions<Entity>,
  methodOptions: IGenericResolverQueryOptions,
) {
  Object.defineProperty(resolver.prototype, queryName, {
    configurable: true,
    writable: true,
    value: async function (conditions: Entity): Promise<boolean> {
      return (<GenericService<Entity>>this.service).deleteEntity(conditions);
    },
  });

  const descriptor = Object.getOwnPropertyDescriptor(
    resolver.prototype,
    queryName,
  );

  if (!descriptor)
    throw new ReferenceError(
      `${resolver.name}.${queryName} must have a descriptor`,
    );

  applyDecorators(
    ...generateDecorators(
      Mutation,
      queryName,
      returnValue(Boolean),
      methodOptions,
    ),
  )(resolver.prototype, queryName, descriptor);

  InputArgs({
    fieldType: options.input?.conditions ?? returnType,
    gql: {
      type:
        /* istanbul ignore next */
        () => options.input?.conditions ?? returnType,
    },
    _name: 'conditions',
  })(resolver.prototype, queryName, 0);

  Reflect.metadata('design:paramtypes', [Object])(
    resolver.prototype,
    queryName,
  );
}

export function resolverFactory<
  Entity extends Record<string, any> = any,
  EntityWrite = Entity,
>(
  options: IGenericResolverOptions<Entity>,
): {
  new (
    service: GenericService<Entity, EntityWrite>,
    dataloader: GQLDataLoader<Entity>,
    moduleRef: ModuleRef,
  ): IGenericResolver;
} {
  const returnType = options.dto ?? options.entityModel;

  @Resolver(returnValue(returnType), { isAbstract: true })
  abstract class BaseClass {
    [index: string]: any; //index signature to allow dynamic properties

    contextId: ContextId;

    constructor(
      @Inject(
        options.service?.serviceToken ?? getServiceToken(options.entityModel),
      )
      protected service: GenericService<Entity, EntityWrite>,
      @Inject(
        options.service?.dataLoaderToken ??
          getDataloaderToken(options.entityModel),
      )
      protected dataLoader: GQLDataLoader<Entity>,
      protected moduleRef: ModuleRef,
    ) {
      this.contextId = ContextIdFactory.create();
      this.moduleRef;
    }
  }

  /**
   *
   * Retrieve information about relations
   *
   */
  const resolverInfoList: IRelationInfo[] = getEntityRelations(
    options.entityModel,
    options.dto,
  );

  const fieldMetadataList = getModelFieldMetadataList(returnType);
  if (fieldMetadataList) {
    Object.keys(fieldMetadataList).forEach((propertyName) => {
      const field = fieldMetadataList[propertyName];
      if (!field.relation) return;

      const objIndex = resolverInfoList.findIndex((obj) => {
        if (obj.join) {
          return obj.join.propertyName === propertyName;
        } else {
          return;
        }
      });

      // if already exists override (dataloader options take priority)
      if (objIndex >= 0) {
        const relInfo = resolverInfoList[objIndex];

        const target = field.relation.targetKey.alias;

        resolverInfoList[objIndex] = {
          ...relInfo,
          join: {
            ...relInfo.join,
            propertyName,
            name: field.relation.sourceKey.alias,
            target,
            referencedColumnName: target,
          },
          relation: {
            ...relInfo.relation,
            propertyName,
            relationType: field.relation.relationType,
            type: field.relation.type,
            target: options.entityModel,
          },
          agField: {
            ...relInfo.agField,
            ...field,
          },
        };
      } else {
        const target = field.relation.targetKey.alias;

        const dataLoaderRelation: IRelationInfo = {
          join: {
            propertyName,
            name: field.relation.sourceKey.alias,
            target,
            referencedColumnName: target,
          },
          relation: {
            propertyName,
            relationType: field.relation.relationType,
            type: field.relation.type,
            isLazy: true,
            target: options.entityModel,
            options: {},
          },
          agField: field,
        };
        resolverInfoList.push(dataLoaderRelation);
      }
    });
  }

  /**
   *
   * Generate Mutations
   *
   */
  const createOptions = options.mutations?.createResource ?? {};
  const updateOptions = options.mutations?.updateResource ?? {};
  const deleteOptions = options.mutations?.deleteResource ?? {};

  @Resolver(returnValue(returnType), {
    isAbstract: true,
  })
  class Mutations extends BaseClass {}

  defineCreateMutation(
    `${options.prefix ?? ''}create${options.entityModel.name}`,
    returnType,
    Mutations,
    options,
    createOptions,
  );

  defineUpdateMutation(
    `${options.prefix ?? ''}update${options.entityModel.name}`,
    returnType,
    Mutations,
    options,
    updateOptions,
  );

  defineDeleteMutation(
    `${options.prefix ?? ''}delete${options.entityModel.name}`,
    returnType,
    Mutations,
    options,
    deleteOptions,
  );

  const getResourceOptions = options.queries?.getResource ?? {};
  const getResourceGridOptions = options.queries?.getResourceGrid ?? {};

  /**
   *
   * Generate Queries
   *
   */
  @Resolver(returnValue(returnType))
  class GenericResolver
    extends (options.readonly ? BaseClass : Mutations)
    implements IGenericResolver {}

  defineGetSingleResource(
    `${options.prefix ?? ''}get${options.entityModel.name}`,
    returnType,
    GenericResolver,
    getResourceOptions,
  );

  defineGetGridResource(
    `${options.prefix ?? ''}get${options.entityModel.name}Grid`,
    returnType,
    GenericResolver,
    getResourceGridOptions,
  );

  /**
   *
   * Generate Field Resolvers
   *
   */

  defineFieldResolver(resolverInfoList, GenericResolver);
  /**
   *
   * Generate dynamic queries
   *
   */

  if (options.customQueries) {
    for (const methodName of Object.keys(options.customQueries)) {
      const queryName = methodName;
      const queryOptions = options.customQueries[methodName];

      if (isCustomSingleQueryOptions(queryOptions)) {
        defineGetSingleResource(
          queryName,
          returnType,
          GenericResolver,
          queryOptions,
        );
      } else {
        defineGetGridResource(
          queryName,
          returnType,
          GenericResolver,
          queryOptions,
        );
      }
    }
  }

  return GenericResolver;
}
