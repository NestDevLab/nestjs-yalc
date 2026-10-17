import { fail, isDirectoryError } from './directory-errors.js';
import type { DirectoryErrorCode } from './directory-errors.js';
import type {
  Identity,
  IdentityRow,
  CommandRow,
  ConsentRow,
  SessionProfile,
  SessionBinding,
  ProofInput,
  SessionUse,
  DirectoryOptions,
  DirectoryLimits,
  Quote,
} from './directory-types.js';

type Validator = (value: unknown) => unknown;
export const check = (condition: unknown, code: DirectoryErrorCode): void => {
  if (!condition) fail(code);
};
const plain = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null || prototype === Object.prototype) return true;
  if (Object.getPrototypeOf(prototype) !== null) return false;
  const ctor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
  const keys = Reflect.ownKeys(Object.prototype);
  return (
    !!ctor &&
    'value' in ctor &&
    typeof ctor.value === 'function' &&
    Object.getOwnPropertyDescriptor(ctor.value, 'name')?.value === 'Object' &&
    Object.getOwnPropertyDescriptor(ctor.value, 'prototype')?.value ===
      prototype &&
    Reflect.ownKeys(prototype).length === keys.length &&
    keys.every((key) => Object.hasOwn(prototype, key))
  );
};
/** Reads descriptors, never properties, so rejected accessors cannot execute. */
export function data(
  raw: unknown,
  keys: readonly string[],
  code: DirectoryErrorCode,
): Record<string, unknown> {
  try {
    check(
      raw !== null &&
        typeof raw === 'object' &&
        !Array.isArray(raw) &&
        plain(raw),
      code,
    );
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const observed = Reflect.ownKeys(descriptors);
    check(
      observed.length === keys.length &&
        observed.every((key) => typeof key === 'string' && keys.includes(key)),
      code,
    );
    return Object.fromEntries(
      keys.map((key) => {
        const descriptor = descriptors[key];
        check(
          descriptor && 'value' in descriptor && descriptor.enumerable,
          code,
        );
        return [key, descriptor.value];
      }),
    );
  } catch (error) {
    if (isDirectoryError(error)) throw error;
    return fail(code);
  }
}
export function record<T>(
  raw: unknown,
  fields: Record<string, Validator>,
  code: DirectoryErrorCode,
): T {
  const value = data(raw, Object.keys(fields), code);
  return Object.fromEntries(
    Object.entries(fields).map(([key, parse]) => [key, parse(value[key])]),
  ) as T;
}
export function text(
  raw: unknown,
  max: number,
  code: DirectoryErrorCode,
  ascii = false,
): string {
  check(
    typeof raw === 'string' &&
      raw.length > 0 &&
      Buffer.byteLength(raw, 'utf8') <= max &&
      (!ascii || /^[A-Za-z0-9_.-]+$/.test(raw)),
    code,
  );
  return raw as string;
}
export function account(raw: unknown, code: DirectoryErrorCode): string {
  check(typeof raw === 'string' && raw.length > 0 && raw.length <= 512, code);
  return raw as string;
}
export function integer(
  raw: unknown,
  code: DirectoryErrorCode,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  check(
    Number.isSafeInteger(raw) &&
      (raw as number) >= min &&
      (raw as number) <= max,
    code,
  );
  return raw as number;
}
export function boolean(raw: unknown, code: DirectoryErrorCode): boolean {
  check(typeof raw === 'boolean', code);
  return raw as boolean;
}
export function oneOf<T extends string>(
  raw: unknown,
  values: readonly T[],
  code: DirectoryErrorCode,
): T {
  check(typeof raw === 'string' && values.includes(raw as T), code);
  return raw as T;
}
export const short = (raw: unknown, code: DirectoryErrorCode): string =>
  text(raw, 128, code, true);
export function id(raw: unknown, code: DirectoryErrorCode): string {
  check(
    typeof raw === 'string' &&
      /^[A-Za-z0-9_-]{43}$/.test(raw) &&
      Buffer.from(raw, 'base64url').toString('base64url') === raw,
    code,
  );
  return raw as string;
}
export function array<T>(
  raw: unknown,
  max: number,
  parse: (value: unknown) => T,
  code: DirectoryErrorCode,
  min = 0,
): T[] {
  try {
    check(Array.isArray(raw), code);
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const length = integer(descriptors.length.value, code, min, max);
    check(Reflect.ownKeys(raw as object).length === length + 1, code);
    return Array.from({ length }, (_, index) => {
      const descriptor = descriptors[String(index)];
      check(descriptor && 'value' in descriptor && descriptor.enumerable, code);
      return parse(descriptor.value);
    });
  } catch (error) {
    if (isDirectoryError(error)) throw error;
    return fail(code);
  }
}
export const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, (item as Record<string, unknown>)[key]]),
        )
      : item,
  );
/** Detach bounded host context and committed values without invoking nested getters. */
export function snapshot(
  raw: unknown,
  code: DirectoryErrorCode,
  depth = 0,
): unknown {
  try {
    check(depth <= 16, code);
    if (raw === null || typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') {
      check(Buffer.byteLength(raw, 'utf8') <= 65536, code);
      return raw;
    }
    if (typeof raw === 'number') {
      check(Number.isFinite(raw), code);
      return raw;
    }
    if (Array.isArray(raw))
      return array(
        raw,
        4096,
        (value) => snapshot(value, code, depth + 1),
        code,
      );
    check(raw !== null && typeof raw === 'object', code);
    const keys = Reflect.ownKeys(raw as object);
    check(
      keys.length <= 4096 && keys.every((key) => typeof key === 'string'),
      code,
    );
    const value = data(raw, keys as string[], code);
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        snapshot(item, code, depth + 1),
      ]),
    );
  } catch (error) {
    if (isDirectoryError(error)) throw error;
    return fail(code);
  }
}
export function identity(
  raw: unknown,
  now: number,
  code: DirectoryErrorCode,
): Identity {
  return record(
    raw,
    {
      issuer: (value) => text(value, 2048, code),
      subject: (value) => text(value, 512, code),
      authTime: (value) => integer(value, code, 0, now),
      methods: (value) =>
        array(value, 16, (method) => text(method, 80, code), code, 1),
    },
    code,
  );
}
export function profile(raw: unknown, now: number): SessionProfile {
  const code = 'authentication_denied';
  const value = data(
    raw,
    [
      'accountId',
      'sessionId',
      'providerId',
      'issuer',
      'subject',
      'authTime',
      'methods',
      'expiresAt',
    ],
    code,
  );
  const verified = identity(
    Object.fromEntries(
      ['issuer', 'subject', 'authTime', 'methods'].map((key) => [
        key,
        value[key],
      ]),
    ),
    now,
    code,
  );
  const expiresAt = integer(value.expiresAt, code);
  check(expiresAt > now, code);
  return {
    ...verified,
    accountId: account(value.accountId, code),
    sessionId: text(value.sessionId, 512, code),
    providerId: text(value.providerId, 80, code, true),
    expiresAt,
  };
}
export function binding(raw: unknown): SessionBinding {
  const code = 'authentication_denied';
  return record(
    raw,
    {
      namespace: (value) => text(value, 128, code),
      sessionId: (value) => text(value, 512, code),
      accountId: (value) => account(value, code),
      issuer: (value) => text(value, 2048, code),
      subject: (value) => text(value, 512, code),
      providerId: (value) => text(value, 80, code, true),
      linkId: (value) => id(value, code),
      generation: (value) => integer(value, code, 1),
    },
    code,
  );
}
/** Copy typed-array data through descriptors rather than overridable accessors/iterators. */
export function bytes(
  raw: unknown,
  min: number,
  max: number,
  code: DirectoryErrorCode,
): Uint8Array {
  try {
    check(raw instanceof Uint8Array, code);
    const prototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
    const length = integer(
      Object.getOwnPropertyDescriptor(prototype, 'byteLength')!.get!.call(raw),
      code,
      min,
      max,
    );
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    check(Reflect.ownKeys(descriptors).length === length, code);
    return Uint8Array.from(
      Array.from({ length }, (_, index) => {
        const descriptor = descriptors[String(index)];
        check(descriptor && 'value' in descriptor, code);
        return integer(descriptor.value, code, 0, 255);
      }),
    );
  } catch (error) {
    if (isDirectoryError(error)) throw error;
    return fail(code);
  }
}
export function proof(raw: unknown): ProofInput {
  const code = 'invalid_input';
  const value = data(raw, ['providerId', 'proof'], code);
  const providerId = text(value.providerId, 80, code, true);
  return {
    providerId,
    proof:
      typeof value.proof === 'string'
        ? text(value.proof, 65536, code)
        : bytes(value.proof, 1, 65536, code),
  };
}
export function sessionUse(raw: unknown): SessionUse {
  const value = data(raw, ['token', 'context'], 'invalid_input');
  const context = snapshot(value.context, 'invalid_input');
  check(
    Buffer.byteLength(canonical(context), 'utf8') <= 65536,
    'invalid_input',
  );
  return { token: text(value.token, 4096, 'invalid_input'), context };
}
export interface Horizon {
  commandId: string;
  issuedAt: number;
  deadline: number;
}
export function horizon(raw: unknown, now: number, window: number): Horizon {
  const commandId = text(raw, 60, 'invalid_input');
  const match = /^(0|[1-9][0-9]*)\.([A-Za-z0-9_-]{43})$/.exec(commandId);
  check(match, 'invalid_input');
  const issuedAt = integer(Number(match![1]), 'invalid_input', 0, now);
  id(match![2], 'invalid_input');
  const deadline = integer(issuedAt + window, 'invalid_input');
  check(now < deadline, 'command_expired');
  return { commandId, issuedAt, deadline };
}
export function row<T>(
  raw: unknown,
  fields: Record<string, Validator>,
  namespace: string,
  max: number,
): T {
  const value = record<Record<string, unknown>>(
    raw,
    {
      namespace: (value) => text(value, 128, 'storage_unavailable'),
      ...fields,
    },
    'storage_unavailable',
  );
  check(
    value.namespace === namespace &&
      Buffer.byteLength(canonical(value), 'utf8') <= max,
    'storage_unavailable',
  );
  return value as T;
}
export function identityRow(
  raw: unknown,
  namespace: string,
  max: number,
): IdentityRow {
  const code = 'storage_unavailable';
  const value = row<IdentityRow>(
    raw,
    {
      issuer: (value) => text(value, 2048, code),
      subject: (value) => text(value, 512, code),
      providerId: (value) => text(value, 80, code, true),
      accountId: (value) => account(value, code),
      linkId: (value) => id(value, code),
      status: (value) => oneOf(value, ['active', 'unlinked'], code),
      generation: (value) => integer(value, code, 1),
      linkedAt: (value) => integer(value, code),
      unlinkedAt: (value) => (value === null ? null : integer(value, code)),
    },
    namespace,
    max,
  );
  check(
    (value.status === 'active' && value.unlinkedAt === null) ||
      (value.status === 'unlinked' &&
        value.unlinkedAt !== null &&
        value.unlinkedAt >= value.linkedAt),
    code,
  );
  return value;
}
export function commandResult(
  raw: unknown,
): import('./directory-types.js').CommandResult {
  const code = 'storage_unavailable';
  return record(
    raw,
    {
      status: (value) =>
        oneOf(value, ['provisioned', 'linked', 'unlinked'], code),
      accountId: (value) => account(value, code),
      linkId: (value) => id(value, code),
      revision: (value) => integer(value, code, 1),
      replay: (value) => boolean(value, code),
    },
    code,
  );
}
export function commandRow(
  raw: unknown,
  namespace: string,
  max: number,
): CommandRow {
  const code = 'storage_unavailable';
  const value = row<CommandRow>(
    raw,
    {
      commandId: (value) => text(value, 60, code),
      accountId: (value) => account(value, code),
      action: (value) => oneOf(value, ['provision', 'link', 'unlink'], code),
      intentDigest: (value) => {
        check(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), code);
        return value;
      },
      result: commandResult,
      reservationId: (value) => short(value, code),
      eventId: (value) => id(value, code),
      expiresAt: (value) => integer(value, code),
    },
    namespace,
    max,
  );
  check(
    value.accountId === value.result.accountId &&
      value.result.replay === false &&
      value.result.status ===
        (
          {
            provision: 'provisioned',
            link: 'linked',
            unlink: 'unlinked',
          } as const
        )[value.action],
    code,
  );
  return value;
}
export function consentRow(
  raw: unknown,
  namespace: string,
  max: number,
): ConsentRow {
  return row(
    raw,
    {
      consentId: (value) => short(value, 'storage_unavailable'),
      commandId: (value) => text(value, 60, 'storage_unavailable'),
      expiresAt: (value) => integer(value, 'storage_unavailable'),
    },
    namespace,
    max,
  );
}
/** Snapshot every callable port once; later mutation of options cannot change policy. */
export function config(raw: DirectoryOptions): DirectoryOptions {
  const code = 'invalid_config';
  const value = data(
    raw,
    [
      'namespace',
      'limits',
      'verifyProof',
      'canonicalProviderForIssuer',
      'authenticateSession',
      'sessionBinding',
      'providerState',
      'authorize',
      'provisioningPolicy',
      'verifyConsent',
      'capacity',
      'directoryStore',
      'now',
      'randomBytes',
    ],
    code,
  );
  const ceilings: DirectoryLimits = {
    maxFreshProofAgeMs: 900000,
    maxLinksPerAccount: 32,
    maxCommandReceiptsPerAccount: 4096,
    maxPendingEvents: 4096,
    maxRecordBytes: 16384,
    maxConcurrentCommands: 64,
    replayWindowMs: 2592000000,
    maxRowsPerNamespace: 1000000,
  };
  const limits = record<DirectoryLimits>(
    value.limits,
    Object.fromEntries(
      Object.entries(ceilings).map(([key, max]) => [
        key,
        (item: unknown) => integer(item, code, 1, max),
      ]),
    ),
    code,
  );
  integer(limits.maxRowsPerNamespace * limits.maxRecordBytes, code);
  const callable = (
    owner: unknown,
    key: string,
  ): ((...args: never[]) => unknown) => {
    try {
      check(owner !== null && typeof owner === 'object', code);
      const descriptor = Object.getOwnPropertyDescriptor(owner, key);
      check(
        descriptor &&
          'value' in descriptor &&
          typeof descriptor.value === 'function',
        code,
      );
      const method = descriptor!.value as (...args: never[]) => unknown;
      return (...args: never[]) => Reflect.apply(method, owner, args);
    } catch (error) {
      if (isDirectoryError(error)) throw error;
      return fail(code);
    }
  };
  const functions = [
    'verifyProof',
    'canonicalProviderForIssuer',
    'authenticateSession',
    'sessionBinding',
    'providerState',
    'authorize',
    'provisioningPolicy',
    'verifyConsent',
    'now',
    'randomBytes',
  ];
  const capacity = Object.fromEntries(
    [
      'quoteGrowth',
      'reserveGrowth',
      'settle',
      'releaseConfirmedAbort',
      'reconcileUnknown',
    ].map((key) => [key, callable(value.capacity, key)]),
  );
  return {
    namespace: text(value.namespace, 128, code),
    limits,
    ...Object.fromEntries(functions.map((key) => [key, callable(raw, key)])),
    capacity,
    directoryStore: {
      transaction: callable(value.directoryStore, 'transaction'),
    },
  } as unknown as DirectoryOptions;
}
export function quote(raw: unknown, bytes: number, deadline: number): Quote {
  const code = 'capacity_exceeded';
  const value = record<Quote>(
    raw,
    {
      quoteId: (item) => short(item, code),
      upperLogicalBytes: (item) => integer(item, code),
      admittedLifetimeUntil: (item) => integer(item, code),
      footprintVersion: (item) => oneOf(item, ['auth-directory.rows.v3'], code),
    },
    code,
  );
  check(
    value.upperLogicalBytes === bytes &&
      value.admittedLifetimeUntil >= deadline,
    code,
  );
  return value;
}
