import {
  expect,
  jest,
  describe,
  it,
  beforeEach,
  beforeAll,
  afterAll,
  afterEach,
} from '@jest/globals';
import { FieldErrorsEnum } from '../fields-error.enum.js';
import {
  convertIfStringToDate,
  errorTrhow,
  stringIsInEnum,
  stringIsInEnumOrThrow,
  validateDate,
  validateDateOrThrow,
  validateStringFormat,
} from '../validator.helper.js';
import { StringFormatEnum } from '../string-format.enum.js';

describe('validator helper test', () => {
  it('convertIfStringToDate should work', async () => {
    let testData = convertIfStringToDate('2020 01 01');
    expect(testData).toBeInstanceOf(Date);

    testData = convertIfStringToDate(new Date());
    expect(testData).toBeInstanceOf(Date);
  });

  it('stringIsInEnum should work', async () => {
    let testData = stringIsInEnum(
      FieldErrorsEnum.INVALID_VALUE,
      FieldErrorsEnum,
    );
    expect(testData).toBeTruthy();

    testData = stringIsInEnum(
      `invalid_${FieldErrorsEnum.INVALID_VALUE}`,
      FieldErrorsEnum,
    );
    expect(testData).toBeFalsy();
  });

  it('stringIsInEnumOrThrow should work', async () => {
    const testData = stringIsInEnumOrThrow(
      FieldErrorsEnum.INVALID_VALUE,
      FieldErrorsEnum,
    );
    expect(testData).toBeTruthy();

    expect(() =>
      stringIsInEnumOrThrow(
        `invalid_${FieldErrorsEnum.INVALID_VALUE}`,
        FieldErrorsEnum,
      ),
    ).toThrow();
  });

  it('validateDate should work', async () => {
    let testData = validateDate(new Date());
    expect(testData).toBeTruthy();

    testData = validateDate('');
    expect(testData).toBeFalsy();

    testData = validateDate({} as Date);
    expect(testData).toBeFalsy();
  });

  it('validateDateOrThrow should work', async () => {
    const testData = validateDateOrThrow(new Date());
    expect(testData).toBeTruthy();

    expect(() => validateDateOrThrow('')).toThrow();
  });

  it('validateStringFormat should work', async () => {
    let testData = validateStringFormat('<>', StringFormatEnum.ALL);
    expect(testData).toBeTruthy();

    testData = validateStringFormat('Eh! Volevi!', StringFormatEnum.ALL);
    expect(testData).toBeFalsy();
  });

  it('errorTrhow should work', async () => {
    expect(() => errorTrhow('')).toThrow(FieldErrorsEnum.INVALID_VALUE);

    expect(() => errorTrhow('', 'customError')).toThrow('customError');
  });
});
