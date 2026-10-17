import { describe, expect, it } from '@jest/globals';
import { createIdentityDirectory, DirectoryError } from '../index.js';
import type { DirectoryOptions, DirectoryTx } from '../directory/index.js';
import {
  harness,
  identity,
  identityRow,
  issuer,
  issuerB,
  linkId,
  proof,
  sessionUse,
  commandId,
  nonce,
} from '../../../test/auth/directory-core/fixtures.mjs';

const make = (options: Record<string, unknown> = {}, seedActor = true) =>
  harness(createIdentityDirectory, { seedActor, options });
const deny = (work: () => Promise<unknown>, code?: string) =>
  code
    ? expect(work()).rejects.toMatchObject({ code })
    : expect(work()).rejects.toBeInstanceOf(DirectoryError);
const alternate = (h: ReturnType<typeof make>) => {
  h.store.seedIdentity(
    identityRow({
      issuer: issuerB,
      subject: 'alt',
      providerId: 'providerB',
      linkId: linkId(21),
    }),
  );
  h.proofs.set('alt', identity('alt', issuerB));
};
const faultAtMutation = (h: ReturnType<typeof make>, mode: string) => {
  h.store.controls.beforeCommit = async (draft: {
    commands: Map<string, unknown>;
  }) => {
    if (draft.commands.size > 0) h.store.controls.outcome = mode;
  };
};

describe('identity directory lifecycle and invariants', () => {
  it('composes provisioning, guarded linking, list snapshots, unlink and same-account generation recovery', async () => {
    const h = make({}, false);
    const provision = await h.provision(commandId(), 'alice');
    expect(provision).toMatchObject({
      status: 'provisioned',
      revision: 1,
      replay: false,
    });
    const saved = h.store.snapshot().identities[0];
    h.bindings.set('session-alice', {
      ...h.bindings.get('session-alice'),
      linkId: saved.linkId,
    });
    expect(await h.guard()).toMatchObject({
      generation: 1,
      accountRevision: 1,
    });
    const first = await h.link(commandId(10000, 2), 'bob');
    first.accountId = 'forged';
    expect(await h.link(commandId(10000, 2), 'bob')).toMatchObject({
      accountId: 'account-alice',
      replay: true,
      revision: 2,
    });
    const listed = await h.list();
    listed.links[0].issuer = 'forged';
    expect((await h.list()).links[0].issuer).toBe(issuer);
    const bob = h.store
      .snapshot()
      .identities.find((row) => row.subject === 'bob')!;
    await h.unlink(commandId(10000, 3), bob.linkId);
    expect(await h.directory.resolveIdentity(identity('bob'))).toBeNull();
    expect(
      (await h.list()).links.find((row) => row.linkId === bob.linkId)?.usable,
    ).toBe(false);
    await h.link(commandId(10000, 4), 'bob');
    expect(
      h.store.snapshot().identities.find((row) => row.subject === 'bob'),
    ).toMatchObject({ generation: 3, linkId: bob.linkId });
    expect(await h.reconcileSession(commandId(10000, 4))).toMatchObject({
      status: 'linked',
      replay: true,
    });
    expect(await h.reconcileProvision(commandId(10000, 5))).toBeNull();
    expect(
      await h.directory.reconcile({
        scope: {
          kind: 'provision',
          proof: proof('alice'),
          enrollmentRef: 'enrollment-1',
        },
        commandId: commandId(),
      }),
    ).toMatchObject({ status: 'provisioned', replay: true });
    expect(await h.reconcileSession(commandId(10000, 5))).toBeNull();
    expect(await h.directory.resolveIdentity(identity('missing'))).toBeNull();
    expect(await h.directory.resolveIdentity(identity('alice'))).toEqual({
      accountId: 'account-alice',
    });
  });

  it('permits unlinking a disabled method using a different active canonical actor', async () => {
    const h = make();
    alternate(h);
    h.providers.set('providerB', { enabled: false, revision: 'off' });
    const listed = await h.list();
    expect(
      listed.links.find((row) => row.providerId === 'providerB')?.usable,
    ).toBe(false);
    await h.unlink();
    expect(
      h.store.snapshot().identities.find((row) => row.subject === 'alt')
        ?.status,
    ).toBe('unlinked');
    await deny(() => h.unlink(commandId(10000, 2)), 'identity_conflict');
  });

  it('keeps read snapshots and canonical routes exact', async () => {
    const h = make();
    const value = await h.directory.resolveIdentity(identity());
    value!.accountId = 'forged';
    expect(await h.directory.resolveIdentity(identity())).toEqual({
      accountId: 'account-alice',
    });
    h.routes.delete(issuer);
    expect(await h.directory.resolveIdentity(identity())).toBeNull();
    await deny(() => h.guard(), 'provider_disabled');
    h.routes.set(issuer, { providerId: 'providerB', revision: 'new' });
    expect(await h.directory.resolveIdentity(identity())).toBeNull();
    await deny(() => h.provision(commandId(10000, 2)), 'provider_disabled');
    h.providers.set('providerB', { enabled: false, revision: 'off' });
    expect(await h.directory.resolveIdentity(identity())).toBeNull();
  });

  it('holds unknown writes until a fresh current-authority reconciliation settles the exact receipt', async () => {
    for (const mode of [
      'committedThenUnknown',
      'unknown',
      'reject',
      'malformed',
      'accessor',
      'missingValue',
      'foreignValue',
    ]) {
      const h = make();
      faultAtMutation(h, mode);
      h.store.controls.foreignValue = {
        status: 'linked',
        accountId: 'foreign',
        linkId: linkId(22),
        revision: 9,
        replay: false,
      };
      await deny(() => h.link(), 'commit_unknown');
      expect(h.calls.release).toHaveLength(0);
      expect(h.store.controls.outcomeGetterCalls).toBe(0);
      await deny(() => h.link(commandId(10000, 2)), 'commit_unknown');
      h.store.controls.beforeCommit = null;
      h.store.controls.outcome = 'normal';
      const fresh = createIdentityDirectory(h.options as DirectoryOptions);
      const found = await fresh.reconcile({
        scope: { kind: 'session', sessionUse: sessionUse() },
        commandId: commandId(),
      });
      expect(found?.replay ?? false).toBe(mode === 'committedThenUnknown');
      if (mode !== 'committedThenUnknown')
        expect(h.capacitySnapshot()[0].state).toBe('held');
    }
  });

  it('releases only explicitly aborted mutations and leaves a released command terminal', async () => {
    const h = make();
    h.store.controls.falseAt = 'insertEvent';
    await deny(() => h.link(), 'identity_conflict');
    expect(h.capacitySnapshot()[0].state).toBe('released');
    h.store.controls.falseAt = null;
    await deny(() => h.link(), 'capacity_exceeded');
    await h.link(commandId(10000, 2));
    expect(h.capacitySnapshot()[1].state).toBe('settled');
  });

  it('allows concurrent identical requests to replay one committed allocation', async () => {
    const h = make();
    let holds = 0;
    let consents = 0;
    let releaseHolds!: () => void;
    let releaseConsent!: () => void;
    const held = new Promise<void>((resolve) => {
      releaseHolds = resolve;
    });
    const consentGate = new Promise<void>((resolve) => {
      releaseConsent = resolve;
    });
    h.controls.onReserve = async () => {
      if (++holds === 2) releaseHolds();
      await held;
    };
    h.controls.onVerifyConsent = async () => {
      consents++;
      if (consents > 2) {
        if (consents === 4) releaseConsent();
        await consentGate;
      }
    };
    const results = await Promise.allSettled([h.link(), h.link()]);
    expect(
      results.filter((result) => result.status === 'fulfilled').length,
    ).toBeGreaterThanOrEqual(1);
    expect(h.store.snapshot().commands).toHaveLength(1);
    expect(h.store.snapshot().events).toHaveLength(1);
  });

  it('enforces the command deadline before all store and funding work', async () => {
    const h = make();
    h.setTime(11000);
    for (const run of [
      () => h.link(),
      () => h.provision(),
      () => h.reconcileSession(),
    ])
      await deny(run, 'command_expired');
    expect(h.store.controls.transactions).toBe(0);
    expect(h.calls.quote).toHaveLength(0);
  });

  it('snapshots caller proof bytes and policy options before asynchronous work', async () => {
    const h = make();
    const input = {
      proof: { providerId: 'providerA', proof: new Uint8Array([1, 2]) },
      enrollmentRef: 'e',
      commandId: commandId(),
    };
    h.controls.proofResult = identity('new');
    const pending = h.directory.provision(input);
    input.proof.proof[0] = 255;
    await pending;
    expect((h.calls.verifyProof[0].proof as Uint8Array)[0]).toBe(1);
    h.options.limits.maxLinksPerAccount = 1;
    h.controls.proofResult = null;
    expect(await h.link(commandId(10000, 2))).toMatchObject({
      status: 'linked',
    });
  });
});

describe('host ports, authorization and serialized persistence failures', () => {
  it.each([
    'verifyProof',
    'canonicalProviderForIssuer',
    'authenticateSession',
    'sessionBinding',
    'providerState',
    'authorize',
    'provisioningPolicy',
    'verifyConsent',
  ])('sanitizes %s failures without leaking host messages', async (name) => {
    const h = make();
    const options = {
      ...h.options,
      [name]: async () => {
        throw Error('private-host-marker');
      },
    };
    const directory = createIdentityDirectory(options as DirectoryOptions);
    const run =
      name === 'provisioningPolicy' || name === 'verifyProof'
        ? () =>
            directory.provision({
              proof: proof('charlie'),
              enrollmentRef: 'e',
              commandId: commandId(),
            })
        : () =>
            directory.link({
              sessionUse: sessionUse(),
              currentProof: proof(),
              targetProof: proof('bob'),
              consent: 'c',
              commandId: commandId(),
            });
    const result = await run().catch((error) => error);
    expect(result).toBeInstanceOf(DirectoryError);
    expect(String(result)).not.toContain('private-host-marker');
  });

  it.each([
    'proofResult',
    'routeResult',
    'providerResult',
    'sessionResult',
    'bindingResult',
    'grantResult',
    'approvalResult',
    'consentResult',
    'quoteResult',
    'reserveResult',
  ])('rejects adversarial %s without invoking accessors', async (field) => {
    const h = make();
    let getters = 0;
    const poison = Object.defineProperty({}, 'extra', {
      enumerable: true,
      get() {
        getters++;
        throw Error('getter');
      },
    });
    h.controls[field] = poison;
    await deny(
      field === 'proofResult' || field === 'approvalResult'
        ? () => h.provision()
        : () => h.link(),
    );
    expect(getters).toBe(0);
    expect(h.store.snapshot().commands).toHaveLength(0);
  });

  it.each([
    'insertIdentity',
    'putAccountRevision',
    'insertConsent',
    'insertCommand',
    'insertEvent',
  ])('rolls back a false %s response without partial state', async (method) => {
    const h = make();
    const before = h.store.snapshot();
    h.store.controls.falseAt = method;
    await deny(() => h.link());
    expect(h.store.snapshot()).toEqual(before);
    expect(h.calls.release).toHaveLength(1);
  });

  it.each([
    'getIdentity',
    'getAccountRevision',
    'getCommand',
    'getLink',
    'getConsent',
    'countRows',
    'countLinks',
    'countCommands',
    'countPendingEvents',
    'listLinks',
  ])(
    'rejects malformed %s before invoking getters or making writes',
    async (method) => {
      const h = make();
      alternate(h);
      let getters = 0;
      const poison = Object.defineProperty({}, 'secret', {
        enumerable: true,
        get() {
          getters++;
          return 1;
        },
      });
      h.store.controls.readAt = method;
      h.store.controls.readValue = method === 'listLinks' ? [poison] : poison;
      await deny(
        method === 'listLinks'
          ? () => h.list()
          : method === 'getLink'
            ? () => h.unlink()
            : () => h.link(),
      );
      expect(h.store.controls.reads).toContain(method);
      expect(getters).toBe(0);
      expect(h.store.controls.writes).toHaveLength(0);
    },
  );

  it('denies unknown read outcomes and malformed transaction adapters before funding', async () => {
    for (const mode of [
      'unknown',
      'confirmed_abort',
      'committedAfterCallbackFailure',
    ]) {
      const h = make();
      h.store.controls.outcome = mode;
      if (mode === 'committedAfterCallbackFailure')
        h.store.controls.throwAt = 'getIdentity';
      await deny(
        () => h.guard(),
        mode === 'confirmed_abort' ? 'storage_unavailable' : 'commit_unknown',
      );
      expect(h.calls.reserve).toHaveLength(0);
    }
    const h = make();
    const directory = createIdentityDirectory({
      ...h.options,
      directoryStore: {
        transaction: async () => ({ status: 'committed', value: null }),
      },
    } as never);
    await deny(() => directory.resolveIdentity(identity()), 'commit_unknown');
    const malformed = createIdentityDirectory({
      ...h.options,
      directoryStore: {
        transaction: async (
          _ns: string,
          work: (tx: object) => Promise<unknown>,
        ) => {
          try {
            await work({});
          } catch {}
          return { status: 'confirmed_abort' };
        },
      },
    } as never);
    await deny(
      () => malformed.resolveIdentity(identity()),
      'storage_unavailable',
    );
  });

  it('sanitizes callback port exceptions and rejects nonboolean store writes', async () => {
    const h = make();
    h.store.controls.throwAt = 'insertIdentity';
    await deny(() => h.link(), 'storage_unavailable');
    expect(h.calls.release).toHaveLength(1);
    const base = make();
    const directory = createIdentityDirectory({
      ...base.options,
      directoryStore: {
        transaction: (
          ns: string,
          work: (tx: DirectoryTx) => Promise<unknown>,
        ) =>
          base.options.directoryStore.transaction(ns, (tx) =>
            work({ ...tx, insertIdentity: async () => 1 as never }),
          ),
      },
    } as DirectoryOptions);
    await deny(
      () =>
        directory.link({
          sessionUse: sessionUse(),
          currentProof: proof(),
          targetProof: proof('bob'),
          consent: 'c',
          commandId: commandId(),
        }),
      'storage_unavailable',
    );
  });

  it('fences lost or malformed settlement and reconciles the durable receipt', async () => {
    for (const settle of [
      async () => {
        throw Error('lost');
      },
      async () => ({ secret: 'unsafe' }),
    ]) {
      const h = make();
      const directory = createIdentityDirectory({
        ...h.options,
        capacity: { ...h.options.capacity, settle },
      } as never);
      await deny(
        () =>
          directory.link({
            sessionUse: sessionUse(),
            currentProof: proof(),
            targetProof: proof('bob'),
            consent: 'c',
            commandId: commandId(),
          }),
        'commit_unknown',
      );
      expect(h.store.snapshot().commands).toHaveLength(1);
      expect(h.calls.release).toHaveLength(0);
      expect(await h.reconcileSession()).toMatchObject({ replay: true });
    }
  });

  it('fences failed release and failed committed reconciliation without a second funding attempt', async () => {
    const h = make();
    h.store.controls.falseAt = 'insertEvent';
    const directory = createIdentityDirectory({
      ...h.options,
      capacity: {
        ...h.options.capacity,
        releaseConfirmedAbort: async () => {
          throw Error('lost');
        },
      },
    } as DirectoryOptions);
    await deny(
      () =>
        directory.link({
          sessionUse: sessionUse(),
          currentProof: proof(),
          targetProof: proof('bob'),
          consent: 'c',
          commandId: commandId(),
        }),
      'commit_unknown',
    );
    await deny(
      () =>
        directory.provision({
          proof: proof('charlie'),
          enrollmentRef: 'e',
          commandId: commandId(10000, 2),
        }),
      'commit_unknown',
    );
    const settled = make();
    await settled.link();
    settled.controls.settleError = Error('lost');
    await deny(() => settled.reconcileSession(), 'commit_unknown');
  });

  it('rechecks authority and proof freshness after growth is held', async () => {
    const h = make();
    h.controls.onReserve = async () => {
      h.controls.grantAllowed = false;
    };
    await deny(() => h.link(), 'authorization_denied');
    expect(h.capacitySnapshot()[0].state).toBe('released');
    const stale = make();
    stale.controls.onReserve = async () => {
      stale.setTime(10500);
      stale.proofs.set('alice', { ...identity(), authTime: 8999 });
    };
    // The verified snapshot remains fresh; changing host proof data cannot mutate it.
    expect(await stale.link()).toMatchObject({ status: 'linked' });
  });

  it('denies forged current identity, stale binding, and missing revision', async () => {
    const h = make();
    h.controls.proofResult = identity('foreign');
    await deny(() => h.link(), 'authentication_denied');
    h.controls.proofResult = null;
    h.bindings.set('session-alice', {
      ...h.bindings.get('session-alice'),
      generation: 2,
    });
    await deny(() => h.guard(), 'authentication_denied');
    h.bindings.set('session-alice', {
      ...h.bindings.get('session-alice'),
      generation: 1,
      namespace: 'other',
    });
    await deny(() => h.guard(), 'authentication_denied');
    const revision = make();
    revision.store.controls.readAt = 'getAccountRevision';
    revision.store.controls.readValue = null;
    await deny(() => revision.guard(), 'authentication_denied');
  });

  it('denies foreign identity, foreign command, consumed consent, and last remaining method', async () => {
    const h = make();
    h.store.seedIdentity(
      identityRow({ subject: 'bob', accountId: 'foreign', linkId: linkId(22) }),
    );
    await deny(() => h.link(), 'identity_conflict');
    await deny(() => h.unlink(commandId(), linkId()), 'last_method');
    const used = make();
    used.store.seedConsent({
      namespace: 'app',
      consentId: `consent-${commandId().slice(-8)}`,
      commandId: commandId(),
      expiresAt: 11000,
    });
    await deny(() => used.link(), 'consent_denied');
    const changed = make();
    await changed.link();
    await deny(() => changed.link(commandId(), 'charlie'), 'command_conflict');
    await deny(
      () =>
        changed.directory.reconcile({
          scope: { kind: 'provision', proof: proof(), enrollmentRef: 'e' },
          commandId: commandId(),
        }),
      'command_conflict',
    );
  });

  it('checks mechanical caps, exact funding horizons and bounded records', async () => {
    for (const patch of [
      { maxRowsPerNamespace: 6 },
      { maxLinksPerAccount: 1 },
      { maxRecordBytes: 100 },
    ]) {
      const h = make();
      const directory = createIdentityDirectory({
        ...h.options,
        limits: { ...h.limits, ...patch },
      } as DirectoryOptions);
      await deny(() =>
        directory.link({
          sessionUse: sessionUse(),
          currentProof: proof(),
          targetProof: proof('bob'),
          consent: 'c',
          commandId: commandId(),
        }),
      );
    }
    for (const field of ['maxCommandReceiptsPerAccount', 'maxPendingEvents']) {
      const h = make();
      const directory = createIdentityDirectory({
        ...h.options,
        limits: { ...h.limits, [field]: 1 },
      } as DirectoryOptions);
      await directory.link({
        sessionUse: sessionUse(),
        currentProof: proof(),
        targetProof: proof('bob'),
        consent: 'c',
        commandId: commandId(),
      });
      await deny(
        () =>
          directory.link({
            sessionUse: sessionUse(),
            currentProof: proof(),
            targetProof: proof('charlie'),
            consent: 'c',
            commandId: commandId(10000, 2),
          }),
        'capacity_exceeded',
      );
    }
    const h = make();
    h.controls.quoteResult = {
      quoteId: 'q',
      upperLogicalBytes: 81920,
      admittedLifetimeUntil: 10999,
      footprintVersion: 'auth-directory.rows.v3',
    };
    await deny(() => h.link(), 'capacity_exceeded');
  });

  it('bounds simultaneous commands and rejects random collisions or invalid randomness', async () => {
    const h = make();
    let unblock!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    h.controls.onProof = async () => {
      entered();
      await gate;
    };
    const directory = createIdentityDirectory({
      ...h.options,
      limits: { ...h.limits, maxConcurrentCommands: 1 },
    } as DirectoryOptions);
    const first = directory.provision({
      proof: proof('charlie'),
      enrollmentRef: 'e',
      commandId: commandId(),
    });
    await ready;
    await deny(
      () =>
        directory.provision({
          proof: proof('bob'),
          enrollmentRef: 'e',
          commandId: commandId(10000, 2),
        }),
      'capacity_exceeded',
    );
    unblock();
    await first;
    for (const randomBytes of [
      () => new Uint8Array(31),
      () => {
        throw Error('rng');
      },
    ]) {
      const bad = make({ randomBytes });
      await deny(() => bad.link(), 'invalid_config');
    }
    const collision = make({ randomBytes: () => new Uint8Array(32).fill(20) });
    await deny(() => collision.link(), 'identity_conflict');
  });

  it('fences backward, nonfinite and throwing clocks', async () => {
    const h = make();
    await h.guard();
    h.setTime(9999);
    await deny(() => h.link(), 'invalid_input');
    await deny(() => h.link(), 'commit_unknown');
    for (const now of [
      () => NaN,
      () => {
        throw Error('clock');
      },
    ]) {
      const bad = make({ now });
      await deny(() => bad.guard(), 'invalid_input');
    }
  });

  it('rejects invalid tagged reconciliation scopes with safe errors', async () => {
    const h = make();
    for (const scope of [
      null,
      {},
      Object.defineProperty({}, 'kind', {
        get() {
          throw Error('getter');
        },
      }),
      { kind: 'other' },
    ])
      await deny(
        () =>
          h.directory.reconcile({
            scope: scope as never,
            commandId: commandId(),
          }),
        'invalid_input',
      );
  });
});

describe('independent review regressions', () => {
  it('settles a lost settlement on a fresh exact-command retry without additional growth', async () => {
    const h = make();
    h.controls.settleError = Error('lost-settlement-acknowledgement');
    await deny(() => h.link(), 'commit_unknown');
    const rows = h.store.snapshot();
    const reservation = rows.commands[0].reservationId;
    expect(h.capacitySnapshot()).toEqual([
      { reservationId: reservation, commandId: commandId(), state: 'held' },
    ]);
    const quotes = h.calls.quote.length;
    const reserves = h.calls.reserve.length;
    const settlements = h.calls.settle.length;
    h.controls.settleError = null;
    const fresh = createIdentityDirectory(h.options as DirectoryOptions);
    expect(
      await fresh.link({
        sessionUse: sessionUse(),
        currentProof: proof(),
        targetProof: proof('bob'),
        consent: 'consent-receipt',
        commandId: commandId(),
      }),
    ).toEqual({ ...rows.commands[0].result, replay: true });
    expect(h.store.snapshot()).toEqual(rows);
    expect(h.calls.quote).toHaveLength(quotes);
    expect(h.calls.reserve).toHaveLength(reserves);
    expect(h.calls.settle.slice(settlements)).toEqual([
      [reservation, commandId()],
    ]);
    expect(h.capacitySnapshot()).toEqual([
      { reservationId: reservation, commandId: commandId(), state: 'settled' },
    ]);
  });

  it.each(['bind', 'name', 'length'])(
    'does not read a supplied callable %s accessor during configuration or invocation',
    async (field) => {
      const h = make();
      let invoked = 0;
      let owner: DirectoryOptions;
      const verify = async function (this: DirectoryOptions) {
        expect(this).toBe(owner);
        return identity('new');
      };
      Object.defineProperty(verify, field, {
        configurable: true,
        get() {
          invoked++;
          throw Error('private-callable-accessor');
        },
      });
      owner = { ...h.options, verifyProof: verify } as DirectoryOptions;
      const directory = createIdentityDirectory(owner);
      expect(invoked).toBe(0);
      expect(
        await directory.provision({
          proof: proof('new'),
          enrollmentRef: 'e',
          commandId: commandId(),
        }),
      ).toMatchObject({ status: 'provisioned' });
      expect(invoked).toBe(0);
    },
  );

  it('calls transaction methods intrinsically and preserves every host-port receiver', async () => {
    const h = make();
    let invoked = 0;
    let owner: DirectoryOptions;
    const store = {
      transaction: async function <T>(
        this: unknown,
        namespace: string,
        work: (tx: DirectoryTx) => Promise<T>,
      ) {
        expect(this).toBe(store);
        return h.options.directoryStore.transaction(
          namespace,
          async (tx: DirectoryTx) => {
            let wrapped: DirectoryTx;
            const getIdentity = async function (
              this: unknown,
              issuer: string,
              subject: string,
            ) {
              expect(this).toBe(wrapped);
              return tx.getIdentity(issuer, subject);
            };
            for (const field of ['bind', 'name', 'length', 'apply'])
              Object.defineProperty(getIdentity, field, {
                configurable: true,
                get() {
                  invoked++;
                  throw Error('private-transaction-accessor');
                },
              });
            wrapped = { ...tx, getIdentity };
            return work(wrapped);
          },
        );
      },
    };
    const capacity = {
      ...h.options.capacity,
      quoteGrowth: async function (
        this: unknown,
        input: Parameters<DirectoryOptions['capacity']['quoteGrowth']>[0],
      ) {
        expect(this).toBe(capacity);
        return h.options.capacity.quoteGrowth(input);
      },
    };
    owner = {
      ...h.options,
      directoryStore: store,
      capacity,
      verifyProof: async function (
        this: unknown,
        input: Parameters<DirectoryOptions['verifyProof']>[0],
      ) {
        expect(this).toBe(owner);
        return h.options.verifyProof(input);
      },
    } as DirectoryOptions;
    const directory = createIdentityDirectory(owner);
    expect(
      await directory.assertCurrentLink({ sessionUse: sessionUse() }),
    ).toMatchObject({ accountId: 'account-alice' });
    expect(
      await directory.link({
        sessionUse: sessionUse(),
        currentProof: proof(),
        targetProof: proof('bob'),
        consent: 'c',
        commandId: commandId(),
      }),
    ).toMatchObject({ status: 'linked' });
    expect(invoked).toBe(0);
  });
});
