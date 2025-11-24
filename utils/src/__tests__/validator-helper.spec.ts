import { describe, expect, it } from '@jest/globals';
import {
  stringIsInEnum,
  stringIsInEnumOrThrow,
} from '../validator-helper.js';

enum TestEnum {
  FOO = 'FOO',
  BAR = 'BAR',
}

describe('validator-helper', () => {
  it('should match enum values case-insensitively', () => {
    expect(stringIsInEnum('foo', TestEnum)).toBe(true);
    expect(stringIsInEnum('Bar', TestEnum)).toBe(true);
    expect(stringIsInEnum('baz', TestEnum)).toBe(false);
  });

  it('should throw with default message when value is invalid', () => {
    expect(() => stringIsInEnumOrThrow('missing', TestEnum)).toThrow(
      'Invalid value missing',
    );
  });

  it('should allow custom error messages', () => {
    expect(() =>
      stringIsInEnumOrThrow('invalid', TestEnum, 'custom message'),
    ).toThrow('custom message');
  });

  it('should return true when value is valid', () => {
    expect(stringIsInEnumOrThrow('foo', TestEnum)).toBe(true);
  });
});
