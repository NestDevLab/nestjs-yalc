import { DefaultError } from '@nestjs-yalc/errors/default.error.js';
import { Err, Ok } from 'neverthrow';

export type Result<T, E extends DefaultError = DefaultError> =
  | Ok<T, E>
  | Err<any, E>;

export type PromiseResult<T> = Promise<Result<T>>;
