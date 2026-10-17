import { fail, isCoreError } from './auth-errors.js';
import type {
  AuthCoreOptions,
  RequestContext,
  VerifiedIdentity,
} from './auth-types.js';

export const safeTime = (
  value: number,
  code: 'invalid_config' | 'session_expired' = 'session_expired',
): number => {
  if (!Number.isSafeInteger(value) || value < 0) fail(code);
  return value;
};

const plainPrototype = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null || prototype === Object.prototype) return true;
  if (Object.getPrototypeOf(prototype) !== null) return false;
  const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
  const expected = Reflect.ownKeys(Object.prototype);
  const observed = Reflect.ownKeys(prototype);
  return (
    !!constructor &&
    'value' in constructor &&
    typeof constructor.value === 'function' &&
    constructor.value.name === 'Object' &&
    constructor.value.prototype === prototype &&
    expected.length === observed.length &&
    expected.every((key) => observed.includes(key))
  );
};

export const ownData = (
  value: unknown,
  allowed: readonly string[],
  required: readonly string[],
  code: 'invalid_input' | 'authentication_denied',
): Record<string, unknown> => {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !plainPrototype(value)
    )
      fail(code);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of Reflect.ownKeys(value)) {
      if (
        typeof key !== 'string' ||
        !allowed.includes(key) ||
        !('value' in descriptors[key])
      )
        fail(code);
    }
    for (const key of required)
      if (!descriptors[key] || !('value' in descriptors[key])) fail(code);
    return Object.fromEntries(
      Object.entries(descriptors).map(([key, descriptor]) => [
        key,
        descriptor.value,
      ]),
    );
  } catch (error) {
    if (isCoreError(error)) throw error;
    return fail(code);
  }
};

export const validText = (value: unknown, max = 4096): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  Buffer.byteLength(value, 'utf8') <= max;

export const validateConfig = (options: AuthCoreOptions): void => {
  if (
    !options ||
    !validText(options.namespace, 128) ||
    !Number.isSafeInteger(options.absoluteTtlMs) ||
    options.absoluteTtlMs <= 0 ||
    !Number.isSafeInteger(options.idleTtlMs) ||
    options.idleTtlMs <= 0 ||
    options.idleTtlMs > options.absoluteTtlMs ||
    !Array.isArray(options.allowedOrigins) ||
    !options.allowedOrigins.every((origin) => {
      if (!validText(origin, 2048) || origin.includes('*')) return false;
      try {
        const parsed = new URL(origin);
        return parsed.origin === origin && parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }) ||
    new Set(options.allowedOrigins).size !== options.allowedOrigins.length ||
    !(options.providers instanceof Map) ||
    [...options.providers].some(
      ([id, verify]) => !validText(id, 80) || typeof verify !== 'function',
    ) ||
    typeof options.resolveIdentity !== 'function' ||
    !options.sessions ||
    typeof options.sessions.transaction !== 'function' ||
    typeof options.now !== 'function' ||
    typeof options.randomBytes !== 'function'
  )
    fail('invalid_config');
};

export const contextFor = (
  raw: unknown,
  operation: 'login' | 'authenticate' | 'refresh' | 'logout',
  origins: readonly string[],
): RequestContext => {
  const data = ownData(
    raw,
    ['transport', 'method', 'origin', 'secFetchSite', 'csrf'],
    ['transport', 'method'],
    'invalid_input',
  );
  if (
    (data.transport !== 'cookie' && data.transport !== 'bearer') ||
    typeof data.method !== 'string' ||
    !/^[A-Z]+$/.test(data.method)
  )
    fail('invalid_input');
  const safe = ['GET', 'HEAD', 'OPTIONS'].includes(data.method);
  if (operation !== 'authenticate' && safe) fail('invalid_input');
  if (data.origin !== undefined && typeof data.origin !== 'string')
    fail('invalid_input');
  if (data.secFetchSite !== undefined && typeof data.secFetchSite !== 'string')
    fail('invalid_input');
  if (data.csrf !== undefined && typeof data.csrf !== 'string')
    fail('invalid_input');
  if (
    data.transport === 'cookie' &&
    !safe &&
    (!origins.includes(data.origin as string) ||
      data.secFetchSite === 'cross-site')
  )
    fail('csrf_denied');
  return data as unknown as RequestContext;
};

export const verifiedIdentity = (
  raw: unknown,
  now: number,
): VerifiedIdentity => {
  try {
    if (
      raw === null ||
      typeof raw !== 'object' ||
      Array.isArray(raw) ||
      !plainPrototype(raw)
    )
      fail('authentication_denied');
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const data: Record<string, unknown> = Object.fromEntries(
      ['issuer', 'subject', 'authTime', 'methods'].map((key) => {
        const descriptor = descriptors[key];
        if (!descriptor || !('value' in descriptor))
          fail('authentication_denied');
        return [key, descriptor.value];
      }),
    );
    if (
      !validText(data.issuer, 2048) ||
      !validText(data.subject, 512) ||
      !Number.isSafeInteger(data.authTime) ||
      (data.authTime as number) < 0 ||
      (data.authTime as number) > now ||
      !Array.isArray(data.methods)
    )
      fail('authentication_denied');
    const methodDescriptors = Object.getOwnPropertyDescriptors(data.methods);
    const length = Object.getOwnPropertyDescriptor(
      data.methods,
      'length',
    )?.value;
    if (
      !Number.isSafeInteger(length) ||
      length < 1 ||
      length > 16 ||
      Reflect.ownKeys(data.methods).length !== length + 1
    )
      fail('authentication_denied');
    const methods: string[] = [];
    for (let index = 0; index < length; index++) {
      const descriptor = methodDescriptors[String(index)];
      if (
        !descriptor ||
        !('value' in descriptor) ||
        !validText(descriptor.value, 80)
      )
        fail('authentication_denied');
      methods.push(descriptor.value);
    }
    return {
      issuer: data.issuer,
      subject: data.subject,
      authTime: data.authTime,
      methods,
    } as VerifiedIdentity;
  } catch (error) {
    if (isCoreError(error)) throw error;
    return fail('authentication_denied');
  }
};

export const resolvedAccount = (raw: unknown): string => {
  const value = ownData(
    raw,
    ['accountId'],
    ['accountId'],
    'authentication_denied',
  );
  if (
    typeof value.accountId !== 'string' ||
    value.accountId.length === 0 ||
    value.accountId.length > 512
  )
    fail('authentication_denied');
  return value.accountId;
};

export const exactInput = (
  value: unknown,
  keys: readonly string[],
  required: readonly string[],
): Record<string, unknown> => ownData(value, keys, required, 'invalid_input');
