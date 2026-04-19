import { StringValueNode, ValueNode } from 'graphql';
import {
  UUIDScalar,
  formatValueErrorMessage,
  formatKindErrorMessage,
  validateUUID,
} from './uuid.scalar.js';
import { UUIDValidationError } from './uuid-validation.error.js';

describe('UUID Scalar Type', () => {
  const uuidScalarType = new UUIDScalar();

  it('should parse a valid ID string', () => {
    const id = '8ebc2ea0-6b32-445e-bfb2-016e4b5cab9a';
    const result = uuidScalarType.parseValue(id);
    expect(result).toBe(id);
  });

  it('should serialize value', () => {
    const result = uuidScalarType.serialize('ID_VALUE');
    expect(result).toBe('ID_VALUE');
  });

  it('should return valid ID values', () => {
    const validStringNodeInputs = mapToStringValueNode([
      '6ad065e6-0e1b-49cf-8d75-f39bdb04cd40',
      '43a21301-b52c-4eb4-b616-11d6c61ca8b6',
      'ee712d1e-0f81-47bd-a78b-862149f87987',
    ]);

    validStringNodeInputs.forEach((input) => {
      const result = uuidScalarType.parseLiteral(input);
      expect(result).toBe(input.value);
    });
  });

  it('should not allow for non-uuid string inputs', () => {
    const invalidInputs: StringValueNode[] = mapToStringValueNode([
      '',
      'INVALID_STRING',
      ' ',
      '123456',
      'xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    ]);

    expect.hasAssertions();
    invalidInputs.forEach((input) => {
      try {
        expect(uuidScalarType.parseLiteral(input)).toThrow();
      } catch (err) {
        expect(err).toBeInstanceOf(UUIDValidationError);
        expect(err.message).toBe(formatValueErrorMessage(input.value));
      }
    });
  });

  it('should not allow non-string inputs', () => {
    const invalidInputs: ValueNode[] = [
      {
        kind: 'IntValue',
        value: '1',
      },
      {
        kind: 'BooleanValue',
        value: true,
      },
    ];

    expect.hasAssertions();
    invalidInputs.forEach((input) => {
      try {
        expect(uuidScalarType.parseLiteral(input)).toThrow();
      } catch (err) {
        expect(err).toBeInstanceOf(UUIDValidationError);
        expect(err.message).toBe(formatKindErrorMessage(input.kind));
      }
    });
  });

  it('validateUUID should return true', () => {
    expect(validateUUID('0000feeb-0360-fd66-f0c9-2e86e1ec37d8')).toEqual(true);
  });

  it('validateUUID should return false', () => {
    const invalidInputs: string[] = [
      '0000feeb10360-fd66-f0c9-2e86e1ec37d8',
      '0000feeb-0360-fd66-f0c9-2e86-1ec37d8',
      '0000feeb-0360-fd66-f0c9-2e86e1ec37d81',
      '0000feeb-0360-fd66-f0c9-2e86e1ec37d',
    ];

    invalidInputs.forEach((input) => {
      expect(validateUUID(input)).toEqual(false);
    });
  });
});

function mapToStringValueNode(values: string[]): StringValueNode[] {
  return values.map((value) => {
    return {
      kind: 'StringValue',
      value: value,
    };
  });
}
