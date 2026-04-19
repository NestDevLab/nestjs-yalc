import {
  describe,
  expect,
  it,
  jest,
  beforeAll,
  beforeEach,
  test,
} from '@jest/globals';

import {
  DEF_FAKER_MAX_TIME,
  FakerHelper,
} from '../faker-helper.js';
import { faker } from '@faker-js/faker';

enum testEnum {
  KEY = 'value',
  VALUE_KEY = 'test',
}
describe('faker helper test', () => {
  // Don't do beforeEach, since we need a single instance
  const fakerHelper = new FakerHelper();
  it('should generate a person object, with first-, lastName, gender and email', () => {
    jest.spyOn(faker.person, 'firstName').mockReturnValueOnce('Elon');
    jest.spyOn(faker.person, 'lastName').mockReturnValueOnce('Musk');
    jest
      .spyOn(faker.internet, 'email')
      .mockReturnValueOnce('Elon_Musk@gmail.test');
    const person = fakerHelper.createPerson();
    expect(person).toBeDefined();
    expect(person.email).toBeDefined();
    expect(person.firstName).toBeDefined();
    expect(person.lastName).toBeDefined();
    expect(person.gender).toBeDefined();
  });

  it('should not reuse already generated names', () => {
    jest.spyOn(faker.person, 'firstName').mockReturnValueOnce('Elon');
    jest.spyOn(faker.person, 'lastName').mockReturnValueOnce('Musk');
    jest
      .spyOn(faker.internet, 'email')
      .mockReturnValueOnce('Elon_Musk@gmail.test');
    const person = fakerHelper.createPerson();
    expect(person).toBeDefined();
    expect(person.email).not.toEqual('ElonMusk@google.test');
    expect(person.firstName).toBeDefined();
    expect(person.lastName).toBeDefined();
    expect(person.gender).toBeDefined();
  });

  it('should be able to use first and lastname to generate email', () => {
    const firstName = 'Elon';
    const lastName = 'Musk';

    const email = fakerHelper.generateNewEmail(firstName, lastName);
    expect(email).toContain(firstName);

    // Not validating lastName as the Faker library may not use it
    // @url https://github.com/Marak/faker.js/issues/791
  });

  it('should be able to use first name, lastname and provider to generate email', () => {
    const firstName = 'Elon';
    const lastName = 'Musk';
    const provider = 'tesla.com';

    const email = fakerHelper.generateNewEmail(firstName, lastName, provider);
    expect(email).toContain(firstName);
    expect(email).toContain(provider);
  });

  it('should generate unique emails on multiple calls', () => {
    const firstName = 'Elon';
    const lastName = 'Musk';
    const provider = 'dogecoin.lol';

    const email1 = fakerHelper.generateNewEmail(firstName, lastName, provider);
    const email2 = fakerHelper.generateNewEmail(firstName, lastName, provider);
    const email3 = fakerHelper.generateNewEmail(firstName, lastName, provider);

    expect(email1).not.toEqual(email2);
    expect(email2).not.toEqual(email3);
  });

  it('should fall back when unique email generation exceeds the time limit', () => {
    const helper = new FakerHelper();
    jest
      .spyOn(faker.internet, 'email')
      .mockReturnValueOnce('same@gmail.test');
    helper.generateNewEmail('Elon', 'Musk', 'gmail.test');

    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(DEF_FAKER_MAX_TIME + 1);
    jest
      .spyOn(faker.internet, 'email')
      .mockReturnValueOnce('same@gmail.test')
      .mockReturnValueOnce('fallback@gmail.test');

    expect(helper.generateNewEmail('Elon', 'Musk', 'gmail.test')).toBe(
      'fallback@gmail.test',
    );
    expect(
      (
        helper as unknown as { generatedEmails: Set<string> }
      ).generatedEmails.has('fallback@gmail.test'),
    ).toBe(true);
  });

  it('should be able to generate a valid birthDate between age 18 and 100 (YYYY-MM-DD) (min age)', () => {
    const currentDate = new Date();
    // make a copy instead of reusing pointer
    const returnDate = new Date(currentDate.toUTCString());
    jest.spyOn(faker.date, 'past').mockReturnValue(returnDate);

    const currentYear = currentDate.getUTCFullYear();
    const currentMonth = currentDate.getUTCMonth() + 1;
    const currentDay = currentDate.getUTCDate();

    const birthDate = fakerHelper.randomBirthDate();
    const splitted = birthDate.split('-');

    expect(parseInt(splitted[0])).toEqual(currentYear - 18);

    // TODO: fix it for the edge cases (february, 00:00 etc.)

    // expect(parseInt(splitted[1])).toEqual(currentMonth);
    // expect(parseInt(splitted[2])).toEqual(currentDay);
  });

  it('should be able to generate a valid birthDate between age 18 and 100 (YYYY-MM-DD) (max age)', () => {
    const currentDate = new Date();
    // make a copy instead of reusing pointer
    const returnDate = new Date(currentDate.valueOf());
    returnDate.setUTCFullYear(returnDate.getUTCFullYear() - 82);
    jest.spyOn(faker.date, 'past').mockReturnValue(returnDate);

    const currentYear = currentDate.getUTCFullYear();
    const currentMonth = currentDate.getUTCMonth() + 1;
    // const currentDay = currentDate.getUTCDate();

    const birthDate = fakerHelper.randomBirthDate();
    const splitted = birthDate.split('-');

    expect(parseInt(splitted[0])).toEqual(currentYear - 100);

    // TODO: fix it for the edge cases (february, 00:00 etc.)

    // expect(parseInt(splitted[1])).toEqual(currentMonth);
    // expect(parseInt(splitted[2])).toEqual(currentDay);
  });

  it('should generate valid lock dates in the past', () => {
    jest.clearAllMocks();
    jest.spyOn(faker.number, 'int').mockReturnValue(0 as never);
    expect(fakerHelper.randomLockDate().valueOf()).toBeLessThan(Date.now());
  });

  it('should generate valid lock dates in the future', () => {
    jest.clearAllMocks();
    jest.spyOn(faker.number, 'int').mockReturnValueOnce(1 as never);
    jest
      .spyOn(faker.date, 'future')
      .mockReturnValueOnce(new Date(Date.now() + 1000));
    expect(fakerHelper.randomLockDate().valueOf()).toBeGreaterThan(Date.now());
  });

  it('should return undefined when no lock is present', () => {
    jest.clearAllMocks();
    jest.spyOn(faker.number, 'int').mockReturnValue(2 as never);
    expect(fakerHelper.randomLockDate()).toEqual(undefined);
  });

  it('should return the first element of the enum', () => {
    jest.clearAllMocks();
    jest.spyOn(faker.number, 'int').mockReturnValue(0 as never);
    expect(fakerHelper.randomFromEnum(testEnum)).toEqual(testEnum.KEY);
  });

  it('should return a decimal', () => {
    jest.clearAllMocks();
    jest.spyOn(faker.number, 'float').mockReturnValue(3.14 as never);
    expect(fakerHelper.randomDecimal(0, 42, 2)).toEqual('3.14');
  });
});
