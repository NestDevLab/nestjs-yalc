export type ODataOrderDirection = 'asc' | 'desc';

export interface ODataOrderBy {
  field: string;
  direction: ODataOrderDirection;
}

/**
 * Parsed representation of the OData-like query façade.
 *
 * This type is intentionally generic and does not depend on any specific ORM.
 * Mapping to concrete query builders (e.g. TypeORM, Prisma) should happen in
 * a thin adapter layer.
 */
export interface ODataQueryParams {
  select?: string[] | null;
  /**
   * Raw $filter expression string. Parsing into an AST / concrete predicates
   * is left to the host application or higher-level helpers.
   */
  filter?: string | null;
  orderBy?: ODataOrderBy[] | null;
  top?: number | null;
  skip?: number | null;
  count?: boolean | null;
  expand?: string[] | null;
}

/**
 * Minimal parsing helper for OData-like query parameters.
 *
 * It accepts a typical NestJS `@Query()` shape (record of strings/arrays) and
 * normalises it into `ODataQueryParams`. Validation is deliberately strict:
 * invalid numeric values or orderBy segments will result in an Error so the
 * caller can translate that into a 400 response.
 */
export function parseODataQueryParams(
  query: Record<string, unknown>,
): ODataQueryParams {
  const get = (key: string): string | undefined => {
    const value = query[key];
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) {
      return String(value[0] ?? '').trim() || undefined;
    }
    const str = String(value).trim();
    return str.length ? str : undefined;
  };

  const selectRaw = get('$select');
  const filterRaw = get('$filter');
  const orderByRaw = get('$orderby');
  const topRaw = get('$top');
  const skipRaw = get('$skip');
  const countRaw = get('$count');
  const expandRaw = get('$expand');

  const params: ODataQueryParams = {};

  if (selectRaw) {
    params.select = selectRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (filterRaw) {
    params.filter = filterRaw;
  }

  if (orderByRaw) {
    const segments = orderByRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const parsed: ODataOrderBy[] = segments.map((segment) => {
      const [fieldRaw, dirRaw] = segment.split(/\s+/).filter(Boolean);
      if (!fieldRaw) {
        throw new Error(`Invalid $orderby segment: "${segment}"`);
      }
      const direction =
        dirRaw && dirRaw.toLowerCase() === 'desc' ? 'desc' : 'asc';
      return { field: fieldRaw, direction };
    });
    if (parsed.length) {
      params.orderBy = parsed;
    }
  }

  if (topRaw !== undefined) {
    const top = Number(topRaw);
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`Invalid $top value: "${topRaw}"`);
    }
    params.top = top;
  }

  if (skipRaw !== undefined) {
    const skip = Number(skipRaw);
    if (!Number.isInteger(skip) || skip < 0) {
      throw new Error(`Invalid $skip value: "${skipRaw}"`);
    }
    params.skip = skip;
  }

  if (countRaw !== undefined) {
    const normalized = countRaw.toLowerCase();
    params.count = normalized === 'true';
  }

  if (expandRaw) {
    params.expand = expandRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return params;
}
