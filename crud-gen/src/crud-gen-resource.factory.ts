import type { Provider } from '@nestjs/common';
import type { ObjectLiteral } from 'typeorm';
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

export interface ICrudGenResourceFactoryOptions<Entity extends ObjectLiteral> {
  entityModel: ClassType<Entity>;
  backend?: false | Omit<ICrudGenBackendFactoryOptions<Entity>, 'entityModel'>;
  graphql?: false | Omit<ICrudGenGraphqlFactoryOptions<Entity>, 'entityModel'>;
  rest?: false | Omit<CrudRestControllerOptions<Entity>, 'entityModel'>;
}

export interface ICrudGenResourceFactoryResult<Entity extends ObjectLiteral> {
  providers: Provider[];
  controllers: ClassType<any>[];
  repository?: ClassType<GenericTypeORMRepository<Entity>>;
  serviceToken?: string;
  dataLoaderToken?: string;
}

export function CrudGenResourceFactory<Entity extends Record<string, any>>({
  entityModel,
  backend,
  graphql,
  rest,
}: ICrudGenResourceFactoryOptions<Entity>): ICrudGenResourceFactoryResult<Entity> {
  const backendProviders =
    backend === false
      ? {
          providers: [],
          repository: undefined,
          serviceToken: undefined,
          dataLoaderToken: undefined,
        }
      : CrudGenBackendFactory<Entity>({
          entityModel,
          ...backend,
        });

  const graphqlProviders =
    graphql === false || graphql === undefined
      ? { providers: [] }
      : CrudGenGraphqlFactory<Entity>({
          entityModel,
          ...graphql,
          serviceToken: graphql.serviceToken ?? backendProviders.serviceToken,
          dataLoaderToken:
            graphql.dataLoaderToken ?? backendProviders.dataLoaderToken,
        });

  const controllers =
    rest === false || rest === undefined
      ? []
      : [
          crudRestControllerFactory<Entity>({
            entityModel,
            ...rest,
            serviceToken: rest.serviceToken ?? backendProviders.serviceToken,
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
