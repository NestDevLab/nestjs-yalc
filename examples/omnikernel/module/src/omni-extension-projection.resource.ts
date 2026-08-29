import { Scope, type InjectionToken, type Provider } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  createProjectionDialect,
  createProjectionGraphqlTypes,
  CrudGenResourceFactory,
  getServiceToken,
  type ICrudGenResourceFactoryResult,
  type ProjectionGraphqlTypes,
} from '@nestjs-yalc/crud-gen';
import {
  GQLDataLoader,
  getDataloaderToken,
  getFn,
} from '@nestjs-yalc/data-loader';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import type { ClassType } from '@nestjs-yalc/types/globals.d.js';
import type { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import type { OmniExtensionProjectionDefinition } from './omni-extension-projection.definition.js';
import { OmniExtensionProjectionService } from './omni-extension-projection.service.js';
import type {
  OmniExtensionProjectionReaderRegistration,
  OmniProjectionReaderCatalogProvider,
} from './omni-projection.catalog.js';
import type { OmniProjectionLifecycleProvider } from './omni-projection.lifecycle.js';
import { OmniScopeContext } from './omni-scope.js';

export interface OmniExtensionProjectionGraphqlNames {
  object: string;
  create: string;
  patch: string;
  conditions: string;
}

export interface OmniExtensionProjectionRegistrationOptions<
  Extension extends ObjectLiteral,
  Api extends ObjectLiteral,
> {
  /** The dynamically created class from createOmniExtensionProjectionEntity. */
  entity: EntityTarget<Extension>;
  /** API-only model used by CrudGen to derive operation names and tokens. */
  apiModel: ClassType<Api>;
  definition: OmniExtensionProjectionDefinition;
  /** Shared catalog provider, normally built from all returned registrations. */
  catalog?: OmniProjectionReaderCatalogProvider;
  /** Request-scoped app policy shared by generated REST and GraphQL. */
  lifecycle?: OmniProjectionLifecycleProvider<
    OmniExtensionProjectionDefinition,
    Extension
  >;
  dbConnection: string;
  rest?: {
    path?: string;
  };
  graphql?: {
    prefix?: string;
    names?: OmniExtensionProjectionGraphqlNames;
  };
  /** Optional consumer-owned ModuleRef token for generated GraphQL DI. */
  moduleRefToken?: InjectionToken;
}

export interface OmniExtensionProjectionRegistration<
  Extension extends ObjectLiteral,
  Api extends ObjectLiteral,
> {
  /** Immutable source contract shared by service, transport, and migrations. */
  definition: OmniExtensionProjectionDefinition;
  /** Register these entities with TypeOrmModule.forFeature in the app module. */
  entities: readonly EntityTarget<Extension>[];
  /** Pass these into OmniKernelModule.register({ reservedRecordKinds }) . */
  reservedRecordKinds: readonly string[];
  /** Include this in createOmniProjectionReaderCatalog([...]). */
  reader: OmniExtensionProjectionReaderRegistration<Extension>;
  /** Generated GraphQL classes, useful when composing additional schema. */
  graphqlTypes: ProjectionGraphqlTypes;
  resource: ICrudGenResourceFactoryResult<Api>;
  controllers: readonly ClassType[];
  providers: readonly Provider[];
  serviceToken: string;
  dataLoaderToken: string;
}

function dialectFor(dataSource: DataSource) {
  if (
    dataSource.options.type !== 'sqlite' &&
    dataSource.options.type !== 'postgres'
  ) {
    throw new TypeError(
      'Omni extension projections require a SQLite or PostgreSQL data source.',
    );
  }
  return createProjectionDialect(dataSource.options.type);
}

function defaultGraphqlNames(
  apiModel: ClassType,
): OmniExtensionProjectionGraphqlNames {
  return {
    object: apiModel.name,
    create: `${apiModel.name}CreateInput`,
    patch: `${apiModel.name}UpdateInput`,
    conditions: `${apiModel.name}Condition`,
  };
}

/**
 * Composes the standard CrudGen REST and GraphQL surfaces for one Omni-owned
 * extension. It deliberately supplies no handwritten controller or resolver:
 * consumers register the returned controllers/providers alongside their
 * trusted OmniKernel scope module and TypeOrmModule.forFeature entities.
 */
export function createOmniExtensionProjectionRegistration<
  Extension extends ObjectLiteral,
  Api extends ObjectLiteral,
>(
  options: OmniExtensionProjectionRegistrationOptions<Extension, Api>,
): OmniExtensionProjectionRegistration<Extension, Api> {
  const graphqlTypes = createProjectionGraphqlTypes(
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
        queries: {
          getResource: { idName: options.definition.identity.column },
        },
      },
      serviceToken,
      dataLoaderToken,
    },
    rest: {
      dto: graphqlTypes.object as ClassType,
      serialize: true,
      ...(options.rest?.path ? { path: options.rest.path } : {}),
      idField: options.definition.identity.column as keyof Api & string,
      serviceToken,
    },
  });

  const reader = Object.freeze({
    type: 'extension' as const,
    id: options.definition.id,
    entity: options.entity,
    definition: options.definition,
  }) as OmniExtensionProjectionReaderRegistration<Extension>;
  const serviceProvider: Provider =
    options.lifecycle && options.catalog
      ? {
          provide: serviceToken,
          scope: Scope.REQUEST,
          useFactory: (
            dataSource: DataSource,
            scope: OmniScopeContext,
            events: YalcEventService,
            lifecycle: any,
            catalog: any,
          ) =>
            new OmniExtensionProjectionService(
              dataSource.getRepository(options.entity),
              dataSource.getRepository(OmniRecordEntity),
              dataSource,
              scope,
              dialectFor(dataSource),
              events,
              options.definition,
              lifecycle,
              catalog,
            ),
          inject: [
            getDataSourceToken(options.dbConnection),
            OmniScopeContext,
            YalcEventService,
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
              events: YalcEventService,
              lifecycle: any,
            ) =>
              new OmniExtensionProjectionService(
                dataSource.getRepository(options.entity),
                dataSource.getRepository(OmniRecordEntity),
                dataSource,
                scope,
                dialectFor(dataSource),
                events,
                options.definition,
                lifecycle,
              ),
            inject: [
              getDataSourceToken(options.dbConnection),
              OmniScopeContext,
              YalcEventService,
              options.lifecycle.token,
            ],
          }
        : {
            provide: serviceToken,
            scope: Scope.REQUEST,
            useFactory: (
              dataSource: DataSource,
              scope: OmniScopeContext,
              events: YalcEventService,
            ) =>
              new OmniExtensionProjectionService(
                dataSource.getRepository(options.entity),
                dataSource.getRepository(OmniRecordEntity),
                dataSource,
                scope,
                dialectFor(dataSource),
                events,
                options.definition,
                undefined,
              ),
            inject: [
              getDataSourceToken(options.dbConnection),
              OmniScopeContext,
              YalcEventService,
            ],
          };
  const providers: Provider[] = [
    serviceProvider,
    {
      provide: dataLoaderToken,
      scope: Scope.REQUEST,
      useFactory: (
        service: OmniExtensionProjectionService<Extension>,
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
    definition: options.definition,
    entities: Object.freeze([options.entity]),
    reservedRecordKinds: Object.freeze([options.definition.owner.kind]),
    reader,
    graphqlTypes: Object.freeze(graphqlTypes),
    resource,
    controllers: Object.freeze([...resource.controllers]),
    providers: Object.freeze(providers),
    serviceToken,
    dataLoaderToken,
  });
}
