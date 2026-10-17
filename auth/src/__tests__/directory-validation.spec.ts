import { describe, expect, it } from '@jest/globals';
import * as v from '../directory/directory-validation.js';
import {
  DirectoryError,
  fail,
  isDirectoryError,
} from '../directory/directory-errors.js';
import {
  harness,
  identity,
  identityRow,
  nonce,
  commandId,
  profile,
  binding,
} from '../../../test/auth/directory-core/fixtures.mjs';
import { createIdentityDirectory } from '../index.js';

const rejects = (work: () => unknown, code = 'invalid_input') =>
  expect(work).toThrow(expect.objectContaining({ code }));
const hostile = () =>
  new Proxy(
    {},
    {
      getPrototypeOf() {
        throw Error('host marker');
      },
    },
  );

describe('closed directory data validators', () => {
  it('keeps errors safe and private error identity unforgeable', () => {
    expect(new DirectoryError('bogus' as never).code).toBe(
      'storage_unavailable',
    );
    expect(new DirectoryError(null as never).message).toBe(
      'storage_unavailable',
    );
    expect(new DirectoryError('consent_denied').message).toBe('consent_denied');
    expect(isDirectoryError(null)).toBe(false);
    expect(isDirectoryError('error')).toBe(false);
    expect(isDirectoryError(new DirectoryError('invalid_input'))).toBe(false);
    try {
      fail('invalid_input');
    } catch (error) {
      expect(isDirectoryError(error)).toBe(true);
    }
  });

  it('accepts exact ordinary and null-prototype records', () => {
    for (const value of [
      { name: 'x' },
      Object.assign(Object.create(null), { name: 'x' }),
    ])
      expect(v.data(value, ['name'], 'invalid_input')).toEqual({ name: 'x' });
    expect(
      v.record(
        { name: 'x' },
        { name: (item) => v.text(item, 1, 'invalid_input') },
        'invalid_input',
      ),
    ).toEqual({ name: 'x' });
  });

  it('rejects prototypes, accessors, symbols, nonenumerable and missing data without getters', () => {
    let reads = 0;
    const getter = Object.defineProperty({}, 'name', {
      enumerable: true,
      get() {
        reads++;
        return 'x';
      },
    });
    const inherited = Object.create({ name: 'x' });
    const custom = Object.assign(Object.create(Object.create(null)), {
      name: 'x',
    });
    const forged = Object.assign(
      Object.create({ constructor: { name: 'Object' } }),
      { name: 'x' },
    );
    for (const value of [
      null,
      [],
      1,
      {},
      getter,
      inherited,
      custom,
      forged,
      hostile(),
      { name: 'x', extra: 1 },
      { name: 'x', [Symbol('x')]: 1 },
      Object.defineProperty({}, 'name', { value: 'x' }),
    ])
      rejects(() => v.data(value, ['name'], 'invalid_input'));
    expect(reads).toBe(0);
    const fake = function Object() {};
    Object.defineProperty(fake, 'name', {
      get() {
        reads++;
        return 'Object';
      },
    });
    const proto = Object.assign(Object.create(null), { constructor: fake });
    rejects(() => v.data(Object.create(proto), [], 'invalid_input'));
    expect(reads).toBe(0);
    const strange = Object.create(Object.create(null));
    rejects(() => v.data(strange, [], 'invalid_input'));
  });

  it('validates exact finite numbers, bytes, character limits and enums', () => {
    expect(v.text('é', 2, 'invalid_input')).toBe('é');
    rejects(() => v.text('é', 1, 'invalid_input'));
    expect(v.text('A_.-9', 10, 'invalid_input', true)).toBe('A_.-9');
    rejects(() => v.text('a/b', 10, 'invalid_input', true));
    expect(v.account('é'.repeat(512), 'invalid_input')).toHaveLength(512);
    for (const value of ['', 1, 'x'.repeat(513)])
      rejects(() => v.account(value, 'invalid_input'));
    for (const value of [NaN, Infinity, -1, 1.5, '1'])
      rejects(() => v.integer(value, 'invalid_input'));
    expect(v.integer(2, 'invalid_input', 1, 2)).toBe(2);
    rejects(() => v.integer(3, 'invalid_input', 1, 2));
    expect(v.boolean(false, 'invalid_input')).toBe(false);
    rejects(() => v.boolean(1, 'invalid_input'));
    expect(v.oneOf('a', ['a', 'b'], 'invalid_input')).toBe('a');
    rejects(() => v.oneOf('c', ['a'], 'invalid_input'));
    rejects(() => v.oneOf(null, ['a'], 'invalid_input'));
    expect(v.short('revision-1', 'invalid_input')).toBe('revision-1');
    expect(v.id(nonce(), 'invalid_input')).toBe(nonce());
    for (const value of [null, 'x', nonce().slice(0, 42) + 'B'])
      rejects(() => v.id(value, 'invalid_input'));
  });

  it('copies dense arrays and rejects sparse, accessor or extra array slots', () => {
    expect(
      v.array(
        [1, 2],
        2,
        (value) => v.integer(value, 'invalid_input'),
        'invalid_input',
        1,
      ),
    ).toEqual([1, 2]);
    let reads = 0;
    const getter = Object.defineProperty([1], '0', {
      enumerable: true,
      get() {
        reads++;
        return 1;
      },
    });
    for (const value of [
      {},
      [],
      [1, 2, 3],
      new Array(1),
      getter,
      Object.assign([1], { extra: 1 }),
      new Proxy([], {
        ownKeys() {
          throw Error('trap');
        },
      }),
    ])
      rejects(() => v.array(value, 2, (item) => item, 'invalid_input', 1));
    expect(reads).toBe(0);
  });

  it('detaches bounded JSON recursively and rejects unknown object capabilities', () => {
    const raw = { z: [null, true, 1, 'x'], a: { b: 2 } };
    const result = v.snapshot(raw, 'invalid_input') as typeof raw;
    result.z[3] = 'changed';
    expect(raw.z[3]).toBe('x');
    expect(v.canonical({ z: 1, a: 2 })).toBe('{"a":2,"z":1}');
    for (const value of [
      undefined,
      () => {},
      Symbol('x'),
      Infinity,
      'x'.repeat(65537),
      { [Symbol('x')]: 1 },
      Object.fromEntries(
        Array.from({ length: 4097 }, (_, index) => [index, 1]),
      ),
    ])
      rejects(() => v.snapshot(value, 'invalid_input'));
    let nested: unknown = null;
    for (let index = 0; index < 18; index++) nested = { nested };
    rejects(() => v.snapshot(nested, 'invalid_input'));
    rejects(() =>
      v.sessionUse({ token: 'x', context: { x: 'a'.repeat(65536) } }),
    );
    expect(v.sessionUse({ token: 't', context: {} })).toEqual({
      token: 't',
      context: {},
    });
  });

  it('requires exact fresh identity/profile and immutable binding shapes', () => {
    expect(v.identity(identity(), 10000, 'invalid_input')).toEqual(identity());
    expect(v.profile(profile(), 10000)).toEqual(profile());
    expect(v.binding(binding())).toEqual(binding());
    rejects(() =>
      v.identity({ ...identity(), authTime: 10001 }, 10000, 'invalid_input'),
    );
    rejects(
      () => v.profile({ ...profile(), expiresAt: 10000 }, 10000),
      'authentication_denied',
    );
    rejects(() =>
      v.identity({ ...identity(), methods: [] }, 10000, 'invalid_input'),
    );
    rejects(
      () => v.binding({ ...binding(), generation: 0 }),
      'authentication_denied',
    );
    rejects(
      () => v.profile({ ...profile(), role: 'owner' }, 10000),
      'authentication_denied',
    );
  });

  it('clones bounded proof bytes and accepts bounded string proof', () => {
    let reads = 0;
    const poisoned = Object.defineProperty(new Uint8Array([1]), 'byteLength', {
      get() {
        reads++;
        return 1;
      },
    });
    rejects(() => v.proof({ providerId: 'p', proof: poisoned }));
    expect(reads).toBe(0);
    rejects(() =>
      v.bytes(new Proxy(new Uint8Array([1]), {}), 1, 10, 'invalid_input'),
    );
    expect(v.proof({ providerId: 'p', proof: 'x' })).toEqual({
      providerId: 'p',
      proof: 'x',
    });
    const raw = { providerId: 'p', proof: new Uint8Array([1]) };
    const copy = v.proof(raw);
    raw.proof[0] = 2;
    expect(copy.proof[0]).toBe(1);
    for (const value of [
      null,
      [],
      new Uint8Array(0),
      new Uint8Array(65537),
      'x'.repeat(65537),
    ])
      rejects(() => v.proof({ providerId: 'p', proof: value }));
  });

  it('parses only canonical time-bearing commands and preserves exact expiry', () => {
    expect(v.horizon(commandId(), 10000, 1000)).toEqual({
      commandId: commandId(),
      issuedAt: 10000,
      deadline: 11000,
    });
    expect(v.horizon(commandId(0), 0, 1000).issuedAt).toBe(0);
    for (const value of [
      '010000.' + nonce(),
      '10001.' + nonce(),
      '1.bad',
      `${Number.MAX_SAFE_INTEGER}.${nonce()}`,
      `10000.${nonce().slice(0, 42)}B`,
    ])
      rejects(() => v.horizon(value, 10000, 1000));
    rejects(() => v.horizon(commandId(), 11000, 1000), 'command_expired');
    rejects(() =>
      v.horizon(
        commandId(Number.MAX_SAFE_INTEGER),
        Number.MAX_SAFE_INTEGER,
        1000,
      ),
    );
  });

  it('validates scoped immutable identity rows and every persisted command field', () => {
    const row = identityRow();
    expect(v.identityRow(row, 'app', 16384)).toEqual(row);
    expect(
      v.identityRow(
        { ...row, status: 'unlinked', unlinkedAt: 10000 },
        'app',
        16384,
      ).unlinkedAt,
    ).toBe(10000);
    for (const patch of [
      { status: 'active', unlinkedAt: 10000 },
      { status: 'unlinked', unlinkedAt: null },
      { status: 'unlinked', unlinkedAt: 9999 },
      { namespace: 'foreign' },
      { generation: 0 },
      { subject: 'x'.repeat(513) },
    ])
      rejects(
        () => v.identityRow({ ...row, ...patch }, 'app', 16384),
        'storage_unavailable',
      );
    rejects(() => v.identityRow(row, 'app', 1), 'storage_unavailable');
    const result = {
      status: 'linked',
      accountId: 'a',
      linkId: nonce(),
      revision: 1,
      replay: false,
    };
    const command = {
      namespace: 'app',
      commandId: commandId(),
      accountId: 'a',
      action: 'link',
      intentDigest: 'a'.repeat(64),
      result,
      reservationId: 'r',
      eventId: nonce(2),
      expiresAt: 11000,
    };
    expect(v.commandRow(command, 'app', 16384)).toEqual(command);
    for (const patch of [
      { intentDigest: 'bad' },
      { intentDigest: null },
      { result: { ...result, replay: true } },
      { accountId: 'other' },
      { action: 'provision' },
    ])
      rejects(
        () => v.commandRow({ ...command, ...patch }, 'app', 16384),
        'storage_unavailable',
      );
    rejects(
      () => v.commandResult({ ...result, revision: 0 }),
      'storage_unavailable',
    );
    const consumed = {
      namespace: 'app',
      consentId: 'c',
      commandId: commandId(),
      expiresAt: 11000,
    };
    expect(v.consentRow(consumed, 'app', 16384)).toEqual(consumed);
  });

  it('pins exact logical quote, finite horizon and required configuration', () => {
    const h = harness(createIdentityDirectory);
    expect(v.config(h.options).namespace).toBe('app');
    const quote = {
      quoteId: 'q',
      upperLogicalBytes: 81920,
      admittedLifetimeUntil: 11000,
      footprintVersion: 'auth-directory.rows.v3',
    };
    expect(v.quote(quote, 81920, 11000)).toEqual(quote);
    for (const patch of [
      { upperLogicalBytes: 1 },
      { admittedLifetimeUntil: 10999 },
      { footprintVersion: 'wrong' },
    ])
      rejects(
        () => v.quote({ ...quote, ...patch }, 81920, 11000),
        'capacity_exceeded',
      );
    for (const patch of [
      { verifyProof: null },
      { namespace: '' },
      { capacity: null },
      { directoryStore: {} },
      { limits: { ...h.limits, maxLinksPerAccount: 33 } },
      { limits: { ...h.limits, maxRecordBytes: 0 } },
      {
        capacity: Object.defineProperty({}, 'quoteGrowth', {
          get() {
            throw Error('getter');
          },
        }),
      },
      {
        directoryStore: new Proxy(
          {},
          {
            getOwnPropertyDescriptor() {
              throw Error('trap');
            },
          },
        ),
      },
    ])
      rejects(
        () => v.config({ ...h.options, ...patch } as never),
        'invalid_config',
      );
  });
  it('sanitizes context reflection traps and never reads forged constructor accessors', () => {
    rejects(() =>
      v.sessionUse({
        token: 'x',
        context: new Proxy(
          {},
          {
            ownKeys() {
              throw Error('private-marker');
            },
          },
        ),
      }),
    );
    for (const field of ['name', 'prototype']) {
      let reads = 0;
      const proto = Object.create(
        null,
        Object.getOwnPropertyDescriptors(Object.prototype),
      );
      const ctor = field === 'name' ? function counterfeit() {} : () => {};
      if (field === 'prototype')
        Object.defineProperty(ctor, 'name', { value: 'Object' });
      Object.defineProperty(ctor, field, {
        get() {
          reads++;
          return field === 'name' ? 'Object' : proto;
        },
      });
      Object.defineProperty(proto, 'constructor', {
        value: ctor,
        configurable: true,
        writable: true,
      });
      rejects(() => v.data(Object.create(proto), [], 'invalid_input'));
      rejects(() =>
        v.sessionUse({ token: 't', context: { nested: Object.create(proto) } }),
      );
      const h = harness(createIdentityDirectory);
      rejects(
        () => v.config(Object.assign(Object.create(proto), h.options)),
        'invalid_config',
      );
      expect(reads).toBe(0);
    }
  });
});
