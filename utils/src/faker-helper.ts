import { faker } from '@faker-js/faker';

// TODO: Probably we can use the internal faker of typeorm-seeding to create uniqueness, like we do here
// (mentioned in https://github.com/w3tecch/typeorm-seeding/issues/98#issuecomment-849585576)

export const DEF_FAKER_MAX_RETRIES = 1500;
export const DEF_FAKER_MAX_TIME = 250;

export class FakerHelper {
  private readonly generatedEmails = new Set<string>();

  // We could also create a new email from the same person,
  // however we assume when this function is called we actually want a different person.
  createPerson() {
    const gender = faker.number.int(1) === 0 ? 'male' : 'female';
    const firstName = faker.person.firstName(gender);
    const lastName = faker.person.lastName(gender);

    return {
      gender,
      firstName,
      lastName,
      email: this.generateNewEmail(firstName, lastName, 'example.test'),
    };
  }

  generateNewEmail(firstName: string, lastName: string, provider?: string) {
    const startTime = Date.now();

    for (let attempt = 0; attempt < DEF_FAKER_MAX_RETRIES; attempt++) {
      const email = faker.internet.email({ firstName, lastName, provider });

      if (!this.generatedEmails.has(email)) {
        this.generatedEmails.add(email);
        return email;
      }

      if (Date.now() - startTime > DEF_FAKER_MAX_TIME) {
        break;
      }
    }

    const fallbackEmail = faker.internet.email({
      firstName,
      lastName,
      provider,
    });
    this.generatedEmails.add(fallbackEmail);
    return fallbackEmail;
  }

  randomFromEnum<T extends Record<string, string | number>>(
    inputEnum: T,
  ): T[keyof T] {
    const randInt = faker.number.int(Object.keys(inputEnum).length - 1);
    return inputEnum[Object.keys(inputEnum)[randInt] as keyof typeof inputEnum];
  }

  randomDecimal = (min: number, max: number, precision: number): string => {
    return faker.number
      .float({ multipleOf: precision, min: min, max: max })
      .toString();
  };

  // Creates a random birthdate for people between 18-82 years of age.
  // Date is returned in format YYYY-MM-DD
  randomBirthDate = (start = 18, end = 100) => {
    const birthDate = faker.date.past({ years: end - start });
    birthDate.setUTCFullYear(birthDate.getUTCFullYear() - start);
    // const [mm, dd, yyyy] = birthDate.format('yyyy-MM-dd').toLocaleString().split(',')[0].split('/');
    const yyyy = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(
      birthDate,
    );
    const mm = new Intl.DateTimeFormat('en', { month: 'numeric' }).format(
      birthDate,
    );
    const dd = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(
      birthDate,
    );

    return `${yyyy}-${mm}-${dd}`;
  };

  // Returns one of three values:
  // * a date in the past (expired lock)
  // * a date in the future (locked till then)
  // * null (db)/undefined (in code) (no locks)
  randomLockDate = () => {
    const random = faker.number.int(2);
    if (random === 0) {
      return faker.date.past({ years: 3 });
    } else if (random === 1) {
      return faker.date.future({ years: 1 });
    } else {
      return undefined;
    }
  };
}
