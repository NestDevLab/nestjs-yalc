import { IsEmail, MinLength } from 'class-validator';
import {
  DateValidation,
  StringFormatMatchValidation,
} from '@nestjs-yalc/field-middleware/validator.decorator.js';

export class CreateUserDto {
  @StringFormatMatchValidation(undefined, {
    toMatch: true,
    pattern: '^[A-Za-z]+$',
  })
  firstName!: string;

  @StringFormatMatchValidation(undefined, {
    toMatch: true,
    pattern: '^[A-Za-z]+$',
  })
  lastName!: string;

  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;
}

export class UpdateUserDto {
  @StringFormatMatchValidation(undefined, {
    toMatch: true,
    pattern: '^[A-Za-z]+$',
  })
  firstName?: string;

  @StringFormatMatchValidation(undefined, {
    toMatch: true,
    pattern: '^[A-Za-z]+$',
  })
  lastName?: string;

  @IsEmail()
  email?: string;

  @MinLength(8)
  password?: string;
}

export class UserMetaDto {
  @DateValidation()
  lastLoginAt?: Date | string;
}
