import { Scope, type InjectionToken, type Provider } from '@nestjs/common';
import { InputType, Int, ObjectType } from '@nestjs/graphql';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  CrudGenResourceFactory,
  FilterOptionType,
  ModelField,
  ModelObject,
  getServiceToken,
  type ICrudGenResourceFactoryResult,
} from '@nestjs-yalc/crud-gen';
import {
  GQLDataLoader,
  getDataloaderToken,
  getFn,
} from '@nestjs-yalc/data-loader';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar.js';
import type { ClassType } from '@nestjs-yalc/types/globals.d.js';
import returnValue from '@nestjs-yalc/utils/returnValue.js';
import { Exclude, Expose } from 'class-transformer';
import { GraphQLJSON } from 'graphql-type-json';
import type { DataSource, ObjectLiteral } from 'typeorm';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import { OmniRelationEntity } from './base/omni-relation.entity.js';
import type {
  OmniProjectionReaderCatalogProvider,
  OmniRelationProjectionReaderRegistration,
} from './omni-projection.catalog.js';
import {
  getOmniRelationProjectionAliases,
  getOmniRelationProjectionAllowedKinds,
  type OmniRelationProjectionDefinition,
} from './omni-relation-projection.definition.js';
import type { OmniProjectionLifecycleProvider } from './omni-projection.lifecycle.js';
import { OmniRelationProjectionService } from './omni-relation-projection.service.js';
import { createOmniRelationKindContract } from './omni-relation-kind.contract.js';
import { OMNI_KERNEL_OPTIONS, OmniScopeContext } from './omni-scope.js';

type RelationGraphqlClass = new () => Record<string, unknown>;

export interface OmniRelationProjectionGraphqlNames {
  object: string;
  create: string;
  patch: string;
  conditions: string;
}

export interface OmniRelationProjectionRegistrationOptions<
  Api extends ObjectLiteral,
> {
  /** API-only model used by CrudGen to derive operation names and tokens. */
  apiModel: ClassType<Api>;
  definition: OmniRelationProjectionDefinition;
  dbConnection: string;
  /** Shared catalog provider, normally built from all returned registrations. */
  catalog?: OmniProjectionReaderCatalogProvider;
  /** Request-scoped app policy injected into the generated service factory. */
  lifecycle?: OmniProjectionLifecycleProvider<
    OmniRelationProjectionDefinition,
    OmniRelationEntity
  >;
  rest?: {
    path?: string;
  };
  graphql?: {
    prefix?: string;
    names?: OmniRelationProjectionGraphqlNames;
  };
  /** Optional consumer-owned ModuleRef token for generated GraphQL DI. */
  moduleRefToken?: InjectionToken;
}

export interface OmniRelationProjectionGraphqlTypes {
  object: RelationGraphqlClass;
  create: RelationGraphqlClass;
  patch: RelationGraphqlClass;
  conditions: RelationGraphqlClass;
}

export interface OmniRelationProjectionRegistration<Api extends ObjectLiteral> {
  /** omni-relation already belongs to OmniKernelModule; no new table exists. */
  entities: readonly [];
  /** Include these in OmniKernelModule.register({ relationKinds }). */
  relationKinds: readonly string[];
  definition: OmniRelationProjectionDefinition;
  reader: OmniRelationProjectionReaderRegistration;
  graphqlTypes: OmniRelationProjectionGraphqlTypes;
  resource: ICrudGenResourceFactoryResult<Api>;
  controllers: readonly ClassType[];
  providers: readonly Provider[];
  serviceToken: string;
  dataLoaderToken: string;
}

function namedClass(
  name: string,
  outputFields?: readonly (readonly [string, string])[],
): RelationGraphqlClass {
  return {
    [name]: class {
      constructor(data?: Record<string, unknown>) {
        if (!outputFields) {
          Object.assign(this, data);
          return;
        }
        for (const [publicName, destination] of outputFields) {
          if (data && Object.prototype.hasOwnProperty.call(data, destination)) {
            (this as Record<string, unknown>)[publicName] = data[destination];
          }
        }
      }
    },
  }[name] as RelationGraphqlClass;
}

function addField(
  target: RelationGraphqlClass,
  name: string,
  destination: string,
  type: unknown,
  nullable: boolean,
): void {
  ModelField({
    dst: destination,
    gqlType: returnValue(type),
    gqlOptions: { nullable },
  })(target.prototype, name);
  Expose()(target.prototype, name);
}

function defaultGraphqlNames(
  apiModel: ClassType,
): OmniRelationProjectionGraphqlNames {
  return {
    object: apiModel.name,
    create: `${apiModel.name}CreateInput`,
    patch: `${apiModel.name}UpdateInput`,
    conditions: `${apiModel.name}Condition`,
  };
}

/** Builds aliased public types while retaining native fields inside the store. */
export function createOmniRelationProjectionGraphqlTypes(
  definition: OmniRelationProjectionDefinition,
  names: OmniRelationProjectionGraphqlNames,
): OmniRelationProjectionGraphqlTypes {
  const aliases = getOmniRelationProjectionAliases(definition);
  const multipleKinds =
    getOmniRelationProjectionAllowedKinds(definition).length > 1;
  const objectFields: Array<readonly [string, string]> = [
    ['guid', 'guid'],
    [aliases.source, 'sourceRecordId'],
    [aliases.target, 'targetRecordId'],
    ['revision', 'revision'],
    [aliases.payload, 'payload'],
  ];
  if (multipleKinds) objectFields.splice(1, 0, [aliases.kind, 'kind']);
  const object = namedClass(names.object, objectFields);
  ObjectType(names.object)(object);
  ModelObject({
    filters: { type: FilterOptionType.INCLUDE, fields: ['guid'] },
  })(object);
  Exclude()(object);
  addField(object, 'guid', 'guid', UUIDScalar, false);
  if (multipleKinds) {
    addField(object, aliases.kind, 'kind', String, false);
  }
  addField(object, aliases.source, 'sourceRecordId', UUIDScalar, false);
  addField(object, aliases.target, 'targetRecordId', UUIDScalar, false);
  addField(object, 'revision', 'revision', Int, false);
  addField(object, aliases.payload, 'payload', GraphQLJSON, true);

  const create = namedClass(names.create);
  InputType(names.create)(create);
  ModelObject()(create);
  addField(create, 'guid', 'guid', UUIDScalar, false);
  if (multipleKinds) {
    addField(create, aliases.kind, 'kind', String, false);
  }
  addField(create, aliases.source, 'sourceRecordId', UUIDScalar, false);
  addField(create, aliases.target, 'targetRecordId', UUIDScalar, false);
  addField(create, aliases.payload, 'payload', GraphQLJSON, true);

  const patch = namedClass(names.patch);
  InputType(names.patch)(patch);
  ModelObject()(patch);
  addField(patch, aliases.payload, 'payload', GraphQLJSON, true);
  addField(patch, 'expectedRevision', 'expectedRevision', Int, false);

  const conditions = namedClass(names.conditions);
  InputType(names.conditions)(conditions);
  ModelObject()(conditions);
  addField(conditions, 'guid', 'guid', UUIDScalar, false);

  return { object, create, patch, conditions };
}

/**
 * Composes one generated REST/GraphQL/dataloader surface over omni-relation.
 * It never creates a relation table or a handwritten transport adapter.
 */
export function createOmniRelationProjectionRegistration<
  Api extends ObjectLiteral,
>(
  options: OmniRelationProjectionRegistrationOptions<Api>,
): OmniRelationProjectionRegistration<Api> {
  const graphqlTypes = createOmniRelationProjectionGraphqlTypes(
    options.definition,
    options.graphql?.names ?? defaultGraphqlNames(options.apiModel),
  );
  const serviceToken = getServiceToken(options.apiModel);
  const dataLoaderToken = getDataloaderToken(options.apiModel);
  const resource = CrudGenResourceFactory<Api>({
    entityModel: options.apiModel,
    backend: false,
    graphql: {
      resolver: {
        dto: graphqlTypes.object as ClassType,
        input: {
          create: graphqlTypes.create as ClassType,
          update: graphqlTypes.patch as ClassType,
          conditions: graphqlTypes.conditions as ClassType,
        },
        ...(options.graphql?.prefix ? { prefix: options.graphql.prefix } : {}),
        ...(options.moduleRefToken !== undefined
          ? { moduleRefToken: options.moduleRefToken }
          : {}),
        queries: { getResource: { idName: 'guid' } },
      },
      serviceToken,
      dataLoaderToken,
    },
    rest: {
      dto: graphqlTypes.object as ClassType,
      serialize: true,
      ...(options.rest?.path ? { path: options.rest.path } : {}),
      idField: 'guid' as keyof Api & string,
      serviceToken,
    },
  });
  const relationKinds = Object.freeze([
    ...getOmniRelationProjectionAllowedKinds(options.definition),
  ]);
  const reader = Object.freeze({
    type: 'relation' as const,
    id: options.definition.id,
    definition: options.definition,
  });
  const serviceProvider: Provider =
    options.lifecycle && options.catalog
      ? {
          provide: serviceToken,
          scope: Scope.REQUEST,
          useFactory: (
            dataSource: DataSource,
            scope: OmniScopeContext,
            omniOptions: { deletion: { relation: 'hard' | 'tombstone' } },
            lifecycle: any,
            catalog: any,
          ) =>
            new OmniRelationProjectionService(
              dataSource.getRepository(OmniRelationEntity),
              scope,
              omniOptions.deletion.relation,
              dataSource.getRepository(OmniRecordEntity),
              createOmniRelationKindContract(relationKinds),
              options.definition,
              dataSource,
              lifecycle,
              catalog,
            ),
          inject: [
            getDataSourceToken(options.dbConnection),
            OmniScopeContext,
            OMNI_KERNEL_OPTIONS,
            options.lifecycle.token,
            options.catalog.token,
          ],
        }
      : options.lifecycle
        ? {
            provide: serviceToken,
            scope: Scope.REQUEST,
            useFactory: (
              dataSource: DataSource,
              scope: OmniScopeContext,
              omniOptions: { deletion: { relation: 'hard' | 'tombstone' } },
              lifecycle: any,
            ) =>
              new OmniRelationProjectionService(
                dataSource.getRepository(OmniRelationEntity),
                scope,
                omniOptions.deletion.relation,
                dataSource.getRepository(OmniRecordEntity),
                createOmniRelationKindContract(relationKinds),
                options.definition,
                dataSource,
                lifecycle,
              ),
            inject: [
              getDataSourceToken(options.dbConnection),
              OmniScopeContext,
              OMNI_KERNEL_OPTIONS,
              options.lifecycle.token,
            ],
          }
        : {
            provide: serviceToken,
            scope: Scope.REQUEST,
            useFactory: (
              dataSource: DataSource,
              scope: OmniScopeContext,
              omniOptions: { deletion: { relation: 'hard' | 'tombstone' } },
            ) =>
              new OmniRelationProjectionService(
                dataSource.getRepository(OmniRelationEntity),
                scope,
                omniOptions.deletion.relation,
                dataSource.getRepository(OmniRecordEntity),
                createOmniRelationKindContract(relationKinds),
                options.definition,
                dataSource,
                undefined,
              ),
            inject: [
              getDataSourceToken(options.dbConnection),
              OmniScopeContext,
              OMNI_KERNEL_OPTIONS,
            ],
          };
  const providers: Provider[] = [
    serviceProvider,
    {
      provide: dataLoaderToken,
      scope: Scope.REQUEST,
      useFactory: (
        service: OmniRelationProjectionService,
        scope: OmniScopeContext,
      ) =>
        new GQLDataLoader(getFn(service as never), 'guid', undefined, {
          cacheKeyFn: (key) => scope.cacheKey(key),
        }),
      inject: [serviceToken, OmniScopeContext],
    },
    ...resource.providers,
  ];

  return Object.freeze({
    entities: Object.freeze([]) as readonly [],
    relationKinds,
    definition: options.definition,
    reader,
    graphqlTypes: Object.freeze(graphqlTypes),
    resource,
    controllers: Object.freeze([...resource.controllers]),
    providers: Object.freeze(providers),
    serviceToken,
    dataLoaderToken,
  });
}
