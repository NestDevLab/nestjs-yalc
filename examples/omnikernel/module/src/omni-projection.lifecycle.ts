import type { InjectionToken } from '@nestjs/common';
import type { EntityManager, ObjectLiteral } from 'typeorm';
import type { OmniProjectionTransactionReaders } from './omni-projection.catalog.js';
import type { OmniScope } from './omni-scope.js';

/**
 * Transaction-aware policy seam shared by fixed Omni projections. Policies
 * are optional, but when registered they are invoked by the store itself—not
 * by transport adapters—so generated REST and GraphQL cannot bypass them.
 */
export interface OmniProjectionLifecycleContext<
  Definition,
  Entity extends ObjectLiteral,
> {
  readonly definition: Definition;
  readonly scope: OmniScope;
  readonly manager: EntityManager;
  /**
   * Manager-bound, scope-constrained readers registered by the composed
   * projections. Policies use these instead of reaching for repositories.
   */
  readonly readers: OmniProjectionTransactionReaders;
  readonly input: Readonly<Record<string, unknown>>;
  /** Present for update and delete after fixed scope/metadata constraints. */
  readonly current?: Entity;
}

export interface OmniProjectionLifecycle<
  Definition,
  Entity extends ObjectLiteral,
> {
  beforeCreate?(
    context: OmniProjectionLifecycleContext<Definition, Entity>,
  ): void | Promise<void>;
  beforeUpdate?(
    context: OmniProjectionLifecycleContext<Definition, Entity>,
  ): void | Promise<void>;
  beforeDelete?(
    context: OmniProjectionLifecycleContext<Definition, Entity>,
  ): void | Promise<void>;
}

/**
 * A Nest token for a request-scoped policy. Resource registrations inject the
 * token into their generated service factory, so the policy is shared by REST
 * and GraphQL but remains app-owned and DI-created.
 */
export interface OmniProjectionLifecycleProvider<
  Definition,
  Entity extends ObjectLiteral,
> {
  readonly token: InjectionToken<OmniProjectionLifecycle<Definition, Entity>>;
}
