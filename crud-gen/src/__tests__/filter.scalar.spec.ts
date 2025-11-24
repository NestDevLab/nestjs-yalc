import { describe, expect, it } from '@jest/globals';
import { Kind, ValueNode } from 'graphql';
import { FilterScalar } from '../filter.scalar.js';
import { FilterType, GeneralFilters } from '../crud-gen.enum.js';
import { CrudGenBadFilterTypeError } from '../crud-gen.error.js';

describe('FilterScalar', () => {
  const scalar = new FilterScalar();

  it('should parse value and memoize results', () => {
    const input = JSON.stringify({
      fieldA: {
        filterType: FilterType.TEXT,
        type: GeneralFilters.CONTAINS,
        filter: 'value',
      },
    });

    const first = scalar.parseValue(input);
    expect(first.expressions?.[0]).toBeDefined();

    const second = scalar.parseValue(input);
    expect(second).toBe(first);
  });

  it('should normalize multicolumn join options', () => {
    const input = JSON.stringify({
      multiColumnJoinOptions: {
        multiColumnJoinOperator: 'AND',
        fieldB: {
          filterType: FilterType.TEXT,
          type: GeneralFilters.CONTAINS,
          filter: 'b',
        },
      },
    });

    const parsed = scalar.parseValue(input);
    expect(parsed.childExpressions?.[0].operator).toBe('AND');
  });

  it('should serialize memoized objects and throw on bad types', () => {
    const parsed = scalar.parseValue('{}');
    expect(scalar.serialize(parsed)).toBe('{}');
    expect(scalar.serialize('raw')).toBe('raw');
    expect(scalar.serialize(123 as any)).toBe('123');
  });

  it('should parse literal strings and reject others', () => {
    const node: ValueNode = { kind: Kind.STRING, value: '{}' } as any;
    expect(scalar.parseLiteral(node)).toEqual({ expressions: [] });

    const badNode: ValueNode = { kind: Kind.INT } as any;
    expect(() => scalar.parseLiteral(badNode)).toThrow(
      CrudGenBadFilterTypeError,
    );
  });
});
