import {
  ODataOrderBy,
  ODataQueryParams,
  parseODataQueryParams,
} from '../api-rest/odata-query.interface.js';

describe('parseODataQueryParams', () => {
  it('parses empty query into an empty params object', () => {
    const result = parseODataQueryParams({});
    expect(result).toEqual<ODataQueryParams>({});
  });

  it('parses $select into an array of fields', () => {
    const result = parseODataQueryParams({ $select: 'id,name, createdAt ' });
    expect(result.select).toEqual(['id', 'name', 'createdAt']);
  });

  it('keeps $filter as a raw string', () => {
    const filter = "status eq 'active' and priority gt 1";
    const result = parseODataQueryParams({ $filter: filter });
    expect(result.filter).toBe(filter);
  });

  it('parses $orderby segments with optional directions', () => {
    const result = parseODataQueryParams({
      $orderby: 'createdAt desc, name , id asc',
    });
    expect(result.orderBy).toEqual<ODataOrderBy[]>([
      { field: 'createdAt', direction: 'desc' },
      { field: 'name', direction: 'asc' },
      { field: 'id', direction: 'asc' },
    ]);
  });

  it('parses $top and $skip as integers', () => {
    const result = parseODataQueryParams({ $top: '10', $skip: '5' });
    expect(result.top).toBe(10);
    expect(result.skip).toBe(5);
  });

  it('parses $count as boolean, treating any non-true value as false', () => {
    expect(parseODataQueryParams({ $count: 'true' }).count).toBe(true);
    expect(parseODataQueryParams({ $count: 'false' }).count).toBe(false);
    expect(parseODataQueryParams({ $count: 'anything-else' }).count).toBe(
      false,
    );
  });

  it('parses $expand into an array of expansion identifiers', () => {
    const result = parseODataQueryParams({
      $expand: 'constraints,lastSelections, pricing ',
    });
    expect(result.expand).toEqual([
      'constraints',
      'lastSelections',
      'pricing',
    ]);
  });

  it('throws for invalid $top values', () => {
    expect(() => parseODataQueryParams({ $top: '0' })).toThrow(
      /Invalid \$top value/,
    );
    expect(() => parseODataQueryParams({ $top: '-1' })).toThrow(
      /Invalid \$top value/,
    );
    expect(() => parseODataQueryParams({ $top: 'NaN' })).toThrow(
      /Invalid \$top value/,
    );
  });

  it('throws for invalid $skip values', () => {
    expect(() => parseODataQueryParams({ $skip: '-1' })).toThrow(
      /Invalid \$skip value/,
    );
    expect(() => parseODataQueryParams({ $skip: 'NaN' })).toThrow(
      /Invalid \$skip value/,
    );
  });

  it('ignores empty $orderby strings without throwing', () => {
    expect(() => parseODataQueryParams({ $orderby: ',' })).not.toThrow();
    expect(() => parseODataQueryParams({ $orderby: '  ' })).not.toThrow();
  });
});
