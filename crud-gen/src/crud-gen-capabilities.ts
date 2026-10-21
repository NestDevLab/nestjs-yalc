/** Repository execution capabilities; neither flag implies the other. */
export interface CrudGenRepositoryCapabilities {
  extendedQueries: boolean;
  structuredGraphqlFilters: boolean;
}

/** Preferred contract for custom repositories. Omitted flags are disabled. */
export interface CrudGenRepositoryCapabilityProvider {
  getCrudGenCapabilities(): Partial<CrudGenRepositoryCapabilities>;
}

/** Services can implement filters without using a CrudGen repository. */
export interface CrudGenStructuredGraphqlFilterProvider {
  supportsStructuredGraphqlFilters(): boolean;
}

export const PLAIN_CRUD_GEN_REPOSITORY_CAPABILITIES: CrudGenRepositoryCapabilities =
  {
    extendedQueries: false,
    structuredGraphqlFilters: false,
  };

type CapabilitySource = {
  getCrudGenCapabilities?: unknown;
  supportsExtendedRepository?: unknown;
  supportsStructuredGraphqlFilters?: unknown;
  getManyExtended?: unknown;
  getManyAndCountExtended?: unknown;
};

function asCapabilitySource(source: unknown): CapabilitySource {
  return source && typeof source === 'object' ? source : {};
}

function declaredFlag(
  declaration: Record<string, unknown>,
  key: keyof CrudGenRepositoryCapabilities,
): boolean {
  if (!(key in declaration)) return false;
  if (typeof declaration[key] !== 'boolean') {
    throw new TypeError(
      `CrudGen repository capability ${key} must be a boolean.`,
    );
  }
  return declaration[key];
}

/**
 * Resolve repository declarations before entering the legacy compatibility path.
 * Invalid declarations fail deterministically; they never enable inferred support.
 */
export function resolveCrudGenRepositoryCapabilities(
  repository: unknown,
): CrudGenRepositoryCapabilities {
  const source = asCapabilitySource(repository);
  if (source.getCrudGenCapabilities !== undefined) {
    if (typeof source.getCrudGenCapabilities !== 'function') {
      throw new TypeError('CrudGen getCrudGenCapabilities must be a function.');
    }
    const declaration: unknown = source.getCrudGenCapabilities();
    if (
      !declaration ||
      typeof declaration !== 'object' ||
      Array.isArray(declaration)
    ) {
      throw new TypeError('CrudGen repository capabilities must be an object.');
    }
    return {
      extendedQueries: declaredFlag(
        declaration as Record<string, unknown>,
        'extendedQueries',
      ),
      structuredGraphqlFilters: declaredFlag(
        declaration as Record<string, unknown>,
        'structuredGraphqlFilters',
      ),
    };
  }
  return resolveLegacyRepositoryCapabilities(source);
}

/** Compatibility only: keep old custom repository implementations working. */
function resolveLegacyRepositoryCapabilities(
  source: CapabilitySource,
): CrudGenRepositoryCapabilities {
  const extendedQueries =
    typeof source.supportsExtendedRepository === 'function'
      ? !!source.supportsExtendedRepository()
      : typeof source.getManyAndCountExtended === 'function' &&
        typeof source.getManyExtended === 'function';
  return {
    extendedQueries,
    structuredGraphqlFilters: extendedQueries,
  };
}

/**
 * Service boundary: honor independent filter support (including projections).
 * Only services without that method use the legacy extended-support signal.
 * Never inspect service repository internals or infer support from list methods.
 */
export function supportsCrudGenStructuredGraphqlFilters(
  service: unknown,
): boolean {
  const source = asCapabilitySource(service);
  return typeof source.supportsStructuredGraphqlFilters === 'function'
    ? !!source.supportsStructuredGraphqlFilters()
    : typeof source.supportsExtendedRepository === 'function' &&
        !!source.supportsExtendedRepository();
}
