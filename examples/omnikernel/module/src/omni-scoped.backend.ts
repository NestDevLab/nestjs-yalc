import {
  Scope,
  type FactoryProvider,
  type InjectionToken,
  type Provider,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getProviderToken } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import {
  getServiceToken,
  type GenericService,
} from '@nestjs-yalc/crud-gen/typeorm/generic.service.js';
import { CGExtendedRepositoryFactory } from '@nestjs-yalc/crud-gen/typeorm/generic.repository.js';
import {
  GQLDataLoader,
  getDataloaderToken,
  getFn,
} from '@nestjs-yalc/data-loader';
import type { ClassType } from '@nestjs-yalc/types/globals.d.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ObjectLiteral } from 'typeorm';
import type { GenericTypeORMRepository } from '@nestjs-yalc/crud-gen/typeorm/generic.repository.js';
import {
  OMNI_KERNEL_OPTIONS,
  OmniScopeContext,
  normalizeOmniKernelRegistrationOptions,
} from './omni-scope.js';

export interface OmniScopedBackendFactoryOptions<Entity extends ObjectLiteral> {
  entityModel: ClassType<Entity>;
  dbConnection: string;
  serviceToken?: string;
  serviceProvider?: InjectionToken;
  additionalInject?: readonly InjectionToken[];
  createService: (
    repository: GenericTypeORMRepository<Entity>,
    scope: OmniScopeContext,
    options: ReturnType<typeof normalizeOmniKernelRegistrationOptions>,
    ...additionalDependencies: unknown[]
  ) => GenericService<Entity>;
}

export interface OmniScopedBackendFactoryResult<Entity extends ObjectLiteral> {
  providers: Provider[];
  repository: ClassType<GenericTypeORMRepository<Entity>>;
}

/**
 * Builds the normal CrudGen service/loader provider shape with a request
 * scope. The loader cache key carries the same scope as the service query.
 */
export function omniScopedBackendProvidersFactory<Entity extends ObjectLiteral>(
  options: OmniScopedBackendFactoryOptions<Entity>,
): OmniScopedBackendFactoryResult<Entity> {
  const serviceToken =
    options.serviceToken ?? getServiceToken(options.entityModel);
  const serviceProviderToken = options.serviceProvider ?? serviceToken;
  const additionalInject = options.additionalInject ?? [];
  const serviceProvider: FactoryProvider = {
    provide: serviceProviderToken,
    scope: Scope.REQUEST,
    useFactory: (
      repository: GenericTypeORMRepository<Entity>,
      scope: OmniScopeContext,
      moduleOptions: ReturnType<typeof normalizeOmniKernelRegistrationOptions>,
      ...additionalDependencies: unknown[]
    ) =>
      options.createService(
        repository,
        scope,
        moduleOptions,
        ...additionalDependencies,
      ),
    inject: [
      getRepositoryToken(options.entityModel, options.dbConnection),
      OmniScopeContext,
      OMNI_KERNEL_OPTIONS,
      ...additionalInject,
    ],
  };
  const loaderProvider: FactoryProvider = {
    provide: getDataloaderToken(options.entityModel),
    scope: Scope.REQUEST,
    useFactory: (
      service: GenericService<Entity>,
      scope: OmniScopeContext,
      events: EventEmitter2,
    ) =>
      new GQLDataLoader(getFn(service), 'guid' as keyof Entity, events, {
        cacheKeyFn: (key) => scope.cacheKey(key),
      }),
    inject: [serviceToken, OmniScopeContext, EventEmitter2],
  };

  const serviceAlias: Provider[] =
    serviceProviderToken === serviceToken
      ? []
      : [{ provide: serviceToken, useExisting: serviceProviderToken }];

  return {
    providers: [serviceProvider, ...serviceAlias, loaderProvider],
    repository: CGExtendedRepositoryFactory(options.entityModel),
  };
}

export function omniBackendServiceToken(
  provider: Parameters<typeof getProviderToken>[0],
): string {
  return getProviderToken(provider);
}
