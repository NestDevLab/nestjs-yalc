import type { Provider } from '@nestjs/common';
import { getMetadataArgsStorage, type ObjectLiteral } from 'typeorm';
import type { ClassType } from '@nestjs-yalc/types/globals.d.js';
import {
  CrudGenBackendFactory,
  CrudGenGraphqlFactory,
  type ICrudGenBackendFactoryOptions,
  type ICrudGenGraphqlFactoryOptions,
} from './crud-gen.helpers.js';
import {
  crudRestControllerFactory,
  type CrudRestControllerOptions,
} from './api-rest/crud-gen-rest.controller.factory.js';
import type { GenericTypeORMRepository } from './typeorm/generic.repository.js';

type CrudGenResourceGraphqlOptions<Entity extends ObjectLiteral> = Omit<
  ICrudGenGraphqlFactoryOptions<Entity>,
  'entityModel'
>;

type CrudGenResourceBackendOptions<Entity extends ObjectLiteral> = Omit<
  ICrudGenBackendFactoryOptions<Entity>,
  'entityModel'
>;

type CrudGenResourceCompactBackendOptions<Entity extends ObjectLiteral> =
  CrudGenResourceBackendOptions<Entity> & {
    dbConnection?: string;
    databaseKey?: keyof Entity;
  };

type CrudGenResourceRestOptions<Entity extends ObjectLiteral> = Omit<
  CrudRestControllerOptions<Entity>,
  'entityModel'
>;

export interface ICrudGenResourceFactoryOptions<Entity extends ObjectLiteral> {
  entityModel: ClassType<Entity>;
  backend?: boolean | CrudGenResourceCompactBackendOptions<Entity>;
  graphql?: boolean | CrudGenResourceGraphqlOptions<Entity>;
  rest?: boolean | CrudGenResourceRestOptions<Entity>;
}

export interface ICrudGenResourceFactoryResult<Entity extends ObjectLiteral> {
  providers: Provider[];
  controllers: ClassType<any>[];
  repository?: ClassType<GenericTypeORMRepository<Entity>>;
  serviceToken?: string;
  dataLoaderToken?: string;
}

function hasProviderOverride(value: unknown): value is { provider: unknown } {
  return !!value && typeof value === 'object' && 'provider' in value;
}

function isGeneratedGraphqlSurface<Entity extends ObjectLiteral>(
  graphql: CrudGenResourceGraphqlOptions<Entity> | false | undefined,
) {
  return !!graphql && !hasProviderOverride(graphql.resolver);
}

function hasGraphqlServiceToken<Entity extends ObjectLiteral>(
  graphql: CrudGenResourceGraphqlOptions<Entity> | false | undefined,
) {
  if (!graphql || hasProviderOverride(graphql.resolver)) {
    return false;
  }

  const resolver = graphql.resolver;

  return !!(graphql.serviceToken ?? resolver.service?.serviceToken);
}

function hasGraphqlDataLoaderToken<Entity extends ObjectLiteral>(
  graphql: CrudGenResourceGraphqlOptions<Entity> | false | undefined,
) {
  if (!graphql || hasProviderOverride(graphql.resolver)) {
    return false;
  }

  const resolver = graphql.resolver;

  return !!(graphql.dataLoaderToken ?? resolver.service?.dataLoaderToken);
}

function hasRestServiceToken<Entity extends ObjectLiteral>(
  rest: CrudGenResourceRestOptions<Entity> | false | undefined,
) {
  return !!rest && !!rest.serviceToken;
}

function inferPrimaryDatabaseKey<Entity extends ObjectLiteral>(
  entityModel: ClassType<Entity>,
) {
  const primaryColumns = getMetadataArgsStorage().columns.filter((column) => {
    return (
      typeof column.target === 'function' &&
      (column.target === entityModel ||
        entityModel.prototype instanceof column.target) &&
      column.options.primary
    );
  });

  if (primaryColumns.length !== 1) {
    throw new Error(
      `CrudGenResourceFactory could not infer a single primary key for ${entityModel.name}. ` +
        'Set backend.databaseKey or backend.dataloader.databaseKey explicitly.',
    );
  }

  return primaryColumns[0].propertyName as keyof Entity;
}

function normalizeBackendOptions<Entity extends ObjectLiteral>(
  entityModel: ClassType<Entity>,
  backend: true | CrudGenResourceCompactBackendOptions<Entity> | undefined,
  graphql: CrudGenResourceGraphqlOptions<Entity> | false | undefined,
  rest: CrudGenResourceRestOptions<Entity> | false | undefined,
): CrudGenResourceBackendOptions<Entity> | undefined {
  const options = backend === true ? {} : backend;
  const needsGeneratedGraphql = isGeneratedGraphqlSurface(graphql);
  const needsDefaultService =
    !options?.service &&
    ((!!rest && !hasRestServiceToken(rest)) ||
      (needsGeneratedGraphql && !hasGraphqlServiceToken(graphql)));
  const needsDefaultDataloader =
    !options?.dataloader &&
    needsGeneratedGraphql &&
    !hasGraphqlDataLoaderToken(graphql);

  if (!options && !needsDefaultService && !needsDefaultDataloader) {
    return undefined;
  }

  const { dbConnection, databaseKey, dataloader, service, ...backendOptions } =
    options ?? {};

  return {
    ...backendOptions,
    service:
      service ??
      (needsDefaultService
        ? { dbConnection: dbConnection ?? 'default' }
        : undefined),
    dataloader:
      dataloader ??
      (needsDefaultDataloader
        ? { databaseKey: databaseKey ?? inferPrimaryDatabaseKey(entityModel) }
        : databaseKey
          ? { databaseKey }
          : undefined),
  };
}

export function CrudGenResourceFactory<Entity extends Record<string, any>>({
  entityModel,
  backend,
  graphql,
  rest,
}: ICrudGenResourceFactoryOptions<Entity>): ICrudGenResourceFactoryResult<Entity> {
  const graphqlOptions:
    | CrudGenResourceGraphqlOptions<Entity>
    | false
    | undefined = graphql === true ? { resolver: {} } : graphql;

  const restOptions: CrudGenResourceRestOptions<Entity> | false | undefined =
    rest === true ? {} : rest;

  const backendOptions =
    backend === false
      ? false
      : normalizeBackendOptions<Entity>(
          entityModel,
          backend === true ? true : backend,
          graphqlOptions,
          restOptions,
        );

  const backendProviders =
    backendOptions === false
      ? {
          providers: [],
          repository: undefined,
          serviceToken: undefined,
          dataLoaderToken: undefined,
        }
      : CrudGenBackendFactory<Entity>({
          entityModel,
          ...backendOptions,
        });

  const graphqlProviders =
    graphqlOptions === false || graphqlOptions === undefined
      ? { providers: [] }
      : CrudGenGraphqlFactory<Entity>({
          entityModel,
          ...graphqlOptions,
          serviceToken:
            graphqlOptions.serviceToken ?? backendProviders.serviceToken,
          dataLoaderToken:
            graphqlOptions.dataLoaderToken ?? backendProviders.dataLoaderToken,
        });

  const controllers =
    restOptions === false || restOptions === undefined
      ? []
      : [
          crudRestControllerFactory<Entity>({
            entityModel,
            ...restOptions,
            serviceToken:
              restOptions.serviceToken ?? backendProviders.serviceToken,
          }),
        ];

  return {
    providers: [...backendProviders.providers, ...graphqlProviders.providers],
    controllers,
    repository: backendProviders.repository,
    serviceToken: backendProviders.serviceToken,
    dataLoaderToken: backendProviders.dataLoaderToken,
  };
}
