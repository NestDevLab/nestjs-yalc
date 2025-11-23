import { ReturnOrFunctionReturnType } from '@nestjs-yalc/types/globals.d.js';

export type ConfigTuple<K, T> = { k: K | K[]; v: T };

// Error message enhancement
export function checkForDuplicateKeys<K>(keys: K[]): void {
  const keySet = new Set<K>();
  for (const key of keys) {
    if (keySet.has(key)) {
      throw new Error(`Duplicate key found in configuration: ${key}`);
    }
    keySet.add(key);
  }
}

const normalizeKeys = <K>(keyOrKeys: K | K[]): K[] =>
  Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];

export class ConfigValueManager {
  /**
   * Examples:
   * 
      value(['myKey', true], false); // boolean example
      value(['myKey', 'myValue']); // string with default undefined
      value(['myKey', undefined], 'myDefaultValue'); // undefined with default string

      value(['myKey', 'myValue'], 'myDefaultValue'); // string example
      value(['myKey', (): string => 'myValue'], () => 'myDefaultValue'); // string example as function
  */
  static value = <K, T, TDefault = undefined>(
    currentKey: K,
    configurations: ConfigTuple<K, T> | ConfigTuple<K, T>[],
    defaultValue?: TDefault,
  ): ReturnOrFunctionReturnType<T> | ReturnOrFunctionReturnType<TDefault> => {
    const foundKeys = new Set<K>();

    const normalizeReturnValue = (
      returnValue: T | TDefault,
    ): ReturnOrFunctionReturnType<T> | ReturnOrFunctionReturnType<TDefault> => {
      if (typeof returnValue === 'function') {
        // eslint-disable-next-line @typescript-eslint/ban-types
        return (returnValue as Function)(); // needed for dealing with dynamic types
      }

      return returnValue as
        | ReturnOrFunctionReturnType<T>
        | ReturnOrFunctionReturnType<TDefault>;
    };

    /**
     * Check if it's a ConfigTuple or an array of ConfigTuples
     */
    const _configurations = Array.isArray(configurations)
      ? configurations
      : [configurations];

    const allKeys = _configurations
      .map((tuple) => normalizeKeys(tuple.k))
      .flat();
    checkForDuplicateKeys(allKeys);

    for (const { k: keys, v: value } of _configurations) {
      const normalizedKeys = normalizeKeys(keys);

      normalizedKeys.forEach((key) => foundKeys.add(key));

      if (normalizedKeys.includes(currentKey)) {
        return normalizeReturnValue(value);
      }
    }

    return normalizeReturnValue(defaultValue as TDefault);
  };

  /**
   * Examples:
   *
   * Key.is('myKey'); // true for 'myKey', and false for other keys
   */
  static is = <K>(currentKey: K, keys: K[] | K, isNegative = false) => {
    const _tuple: ConfigTuple<K, boolean> = {
      k: normalizeKeys(keys),
      v: !isNegative,
    };
    return this.value(currentKey, _tuple, isNegative);
  };

  /**
   * Examples:
   *
   * Key.only('myKey', 'myValue'); // this will return 'myValue' for 'myKey', and undefined for other keys
   */
  static only = <K, T>(
    currentKey: K,
    keys: K[] | K,
    value: T,
  ): ReturnOrFunctionReturnType<T> | undefined => {
    const _tuple: ConfigTuple<K, T> = { k: normalizeKeys(keys), v: value };
    return this.value(currentKey, _tuple, undefined);
  };

  /**
   * Examples:
   *
   * Key.skip('myKey', 'myValue'); // this will return undefined for 'myKey', and 'myValue' for other keys
   */
  static skip = <K, T>(
    currentKey: K,
    keys: K[] | K,
    value: T,
  ): ReturnOrFunctionReturnType<T> | undefined => {
    const _tuple: ConfigTuple<K, undefined> = {
      k: normalizeKeys(keys),
      v: undefined,
    };
    return this.value(currentKey, _tuple, value);
  };
}
