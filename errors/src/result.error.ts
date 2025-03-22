import { err, ok } from 'neverthrow';
import { Result } from '../../event-manager/src/event-result.types.js';
import { errorToDefaultError, IDefaultErrorOptions } from './default.error.js';

export const tryCatch = <T>(
  fn: () => T,
  options: IDefaultErrorOptions = {},
): Result<T> => {
  try {
    return ok(fn());
  } catch (error) {
    return err(errorToDefaultError(error as Error, options));
  }
};

export const tryCatchAsync = async <T>(
  fn: () => Promise<T>,
  options: IDefaultErrorOptions = {},
): Promise<Result<T>> => {
  try {
    return ok(await fn());
  } catch (error) {
    return err(errorToDefaultError(error as Error, options));
  }
};
