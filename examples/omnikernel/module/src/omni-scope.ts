import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

export interface OmniScope {
  readonly scopeId: string;
  cacheKey(key: string): string;
}

export type OmniScopeResolver = (request: unknown) => string | undefined;

export interface OmniKernelRegistrationOptions {
  dbConnection: string;
  /**
   * Authentication adapters resolve a trusted server scope from the request.
   * The adapter owns authentication; OmniKernel never reads a client DTO field.
   */
  resolveScope?: OmniScopeResolver;
  /**
   * Compatibility/default partition for applications that do not yet have an
   * authentication adapter. It is server configuration, never request input.
   */
  defaultScopeId?: string;
  relationKinds?: readonly string[];
  deletion?: Partial<OmniDeletionPolicies>;
}

export type OmniDeletePolicy = 'hard' | 'tombstone';

export interface OmniDeletionPolicies {
  named: OmniDeletePolicy;
  record: OmniDeletePolicy;
  document: OmniDeletePolicy;
  collection: OmniDeletePolicy;
  relation: OmniDeletePolicy;
  externalRef: OmniDeletePolicy;
}

export const OMNI_KERNEL_OPTIONS = Symbol('OMNI_KERNEL_OPTIONS');

export const defaultOmniDeletionPolicies: OmniDeletionPolicies = {
  named: 'hard',
  record: 'tombstone',
  document: 'tombstone',
  collection: 'tombstone',
  relation: 'hard',
  externalRef: 'hard',
};

function normalizeOmniDeletionPolicies(
  deletion: Partial<OmniDeletionPolicies> | undefined,
): OmniDeletionPolicies {
  const knownResources = new Set(Object.keys(defaultOmniDeletionPolicies));
  for (const [resource, policy] of Object.entries(deletion ?? {})) {
    if (!knownResources.has(resource)) {
      throw new TypeError(
        `Unknown OmniKernel deletion policy resource: ${resource}.`,
      );
    }
    if (policy !== 'hard' && policy !== 'tombstone') {
      throw new TypeError(
        `OmniKernel deletion policy for ${resource} must be hard or tombstone.`,
      );
    }
  }
  return {
    ...defaultOmniDeletionPolicies,
    ...deletion,
  };
}

export function normalizeOmniKernelRegistrationOptions(
  options: string | OmniKernelRegistrationOptions,
): Required<
  Pick<
    OmniKernelRegistrationOptions,
    'dbConnection' | 'defaultScopeId' | 'relationKinds'
  >
> &
  Omit<
    OmniKernelRegistrationOptions,
    'dbConnection' | 'defaultScopeId' | 'relationKinds' | 'deletion'
  > & {
    deletion: OmniDeletionPolicies;
  } {
  const candidate =
    typeof options === 'string' ? { dbConnection: options } : options;
  if (!candidate.dbConnection) {
    throw new TypeError(
      'OmniKernelModule requires a database connection name.',
    );
  }
  if (
    candidate.defaultScopeId !== undefined &&
    (candidate.defaultScopeId.trim().length === 0 ||
      candidate.defaultScopeId.length > 64)
  ) {
    throw new TypeError('OmniKernel defaultScopeId must be 1-64 characters.');
  }

  return {
    ...candidate,
    defaultScopeId: candidate.defaultScopeId ?? 'default',
    relationKinds: candidate.relationKinds ?? [],
    deletion: normalizeOmniDeletionPolicies(candidate.deletion),
  };
}

type RequestEnvelope = { req?: unknown };

/**
 * Request-scoped server context used by every Omni generated API and loader.
 * It is intentionally unavailable when neither the trusted adapter nor a
 * configured default provides a scope.
 */
@Injectable({ scope: Scope.REQUEST })
export class OmniScopeContext implements OmniScope {
  readonly scopeId: string;

  constructor(
    @Inject(REQUEST) request: unknown,
    @Inject(OMNI_KERNEL_OPTIONS)
    options: ReturnType<typeof normalizeOmniKernelRegistrationOptions>,
  ) {
    const requestForResolver =
      (request as RequestEnvelope | undefined)?.req ?? request;
    const scopeId = options.resolveScope
      ? options.resolveScope(requestForResolver)
      : options.defaultScopeId;
    if (!scopeId || scopeId.trim().length === 0 || scopeId.length > 64) {
      throw new TypeError('Omni scope context is unavailable.');
    }
    this.scopeId = scopeId;
  }

  cacheKey(key: string): string {
    return `${this.scopeId}:${key}`;
  }
}
