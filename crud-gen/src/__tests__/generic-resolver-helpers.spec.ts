import { describe, expect, it } from '@jest/globals';
import {
  checkFinalId,
  hasExtraArgs,
  hasFilters,
  isCustomSingleQueryOptions,
  isExtraInputStrict,
  isIDArg,
} from '../api-graphql/generic.resolver.js';

describe('generic.resolver helpers', () => {
  it('should detect IIDArg structures', () => {
    expect(isIDArg({ name: 'id', type: () => String })).toBe(true);
    expect(isIDArg('id')).toBe(false);
  });

  it('should validate extra input structures', () => {
    expect(
      isExtraInputStrict({
        middleware: () => undefined,
      }),
    ).toBe(true);

    expect(isExtraInputStrict({} as any)).toBe(false);
  });

  it('should throw when final id is undefined', () => {
    expect(() => checkFinalId(undefined)).toThrow("Can't have an undefined ID");
    expect(() => checkFinalId('id')).not.toThrow();
  });

  it('should detect custom single query options', () => {
    const options = { isSingleResource: true };
    expect(isCustomSingleQueryOptions(options as any)).toBe(true);
  });

  it('should detect extra args and filters presence', () => {
    expect(
      hasExtraArgs({
        extraArgs: { filter: { options: {} as any } },
      } as any),
    ).toBe(true);

    expect(
      hasFilters({
        where: { filters: { id: { value: 1 } } },
      } as any),
    ).toBe(true);

    expect(
      hasFilters({
        order: { name: { order: 'ASC' } },
      } as any),
    ).toBe(true);

    expect(hasFilters({} as any)).toBeFalsy();
  });
});
