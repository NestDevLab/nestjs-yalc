import { createHash } from 'node:crypto';
import { fail, isDirectoryError } from './directory-errors.js';
import type { DirectoryErrorCode } from './directory-errors.js';
import * as v from './directory-validation.js';
import type {
  CommandResult,
  CommandRow,
  DirectoryOptions,
  DirectoryTx,
  GuardResult,
  Identity,
  IdentityDirectory,
  IdentityRow,
  ProofInput,
  SessionBinding,
  SessionProfile,
  SessionUse,
} from './directory-types.js';

type Action = 'provision' | 'link' | 'unlink';
interface Actor {
  profile: SessionProfile;
  binding: SessionBinding;
  row: IdentityRow;
  revision: number;
}
interface Intent {
  action: Action;
  horizon: v.Horizon;
  accountId: string;
  consentId: string;
  digest: string;
  target: Identity | null;
  providerId: string;
  linkId: string | null;
  actor: Actor | null;
}
interface Plan {
  target: IdentityRow | null;
  revision: number | null;
  receipt: CommandRow | null;
  links: IdentityRow[];
}
const txKeys = [
  'getIdentity',
  'getLink',
  'listLinks',
  'getAccountRevision',
  'getCommand',
  'getConsent',
  'countRows',
  'countLinks',
  'countCommands',
  'countPendingEvents',
  'insertIdentity',
  'updateIdentity',
  'insertCommand',
  'insertConsent',
  'putAccountRevision',
  'insertEvent',
  'acknowledgeEvent',
];
const hash = (value: unknown): string =>
  createHash('sha256').update(v.canonical(value)).digest('hex');
const next = (value: number): number =>
  v.integer(value + 1, 'storage_unavailable', 1);

/** Pure trusted-host facade. All persistence, proof and funding authority stays injected. */
export function createIdentityDirectory(
  options: DirectoryOptions,
): IdentityDirectory {
  const settings = v.config(options);
  const { namespace, limits } = settings;
  let fenced = false;
  let lastTime = 0;
  let concurrent = 0;
  const confirmedAborts = new WeakSet<object>();
  const time = (): number => {
    try {
      const observed = v.integer(settings.now(), 'invalid_input');
      v.check(observed >= lastTime, 'invalid_input');
      lastTime = observed;
      return observed;
    } catch {
      fenced = true;
      return fail('invalid_input');
    }
  };
  const port = async <T>(
    call: () => Promise<T>,
    code: DirectoryErrorCode,
  ): Promise<T> => {
    try {
      return await call();
    } catch {
      return fail(code);
    }
  };
  const atomic = async <T>(
    work: (tx: DirectoryTx) => Promise<T>,
  ): Promise<T> => {
    let completed = false;
    let invoked = false;
    let failed = false;
    let expected: T;
    let callbackError: unknown;
    let raw: unknown;
    try {
      raw = await settings.directoryStore.transaction(
        namespace,
        async (rawTx) => {
          try {
            v.check(!invoked, 'storage_unavailable');
            invoked = true;
            const descriptors = Object.getOwnPropertyDescriptors(rawTx);
            const tx = Object.fromEntries(
              txKeys.map((key) => {
                const descriptor = descriptors[key];
                v.check(
                  descriptor &&
                    'value' in descriptor &&
                    typeof descriptor.value === 'function',
                  'storage_unavailable',
                );
                const method = descriptor.value as (
                  ...args: unknown[]
                ) => Promise<unknown>;
                return [
                  key,
                  (...args: unknown[]) =>
                    port(
                      () => Reflect.apply(method, rawTx, args),
                      'storage_unavailable',
                    ),
                ];
              }),
            ) as unknown as DirectoryTx;
            expected = await work(tx);
            completed = true;
            // Return a different snapshot so adapter mutation cannot change our evidence.
            return v.snapshot(expected, 'storage_unavailable') as T;
          } catch (error) {
            failed = true;
            callbackError = error;
            throw error;
          }
        },
      );
    } catch {
      fenced = true;
      return fail('commit_unknown');
    }
    try {
      const envelope = v.data(
        raw,
        [
          'status',
          ...(Object.getOwnPropertyDescriptor(raw as object, 'status')
            ?.value === 'committed'
            ? ['value']
            : []),
        ],
        'commit_unknown',
      );
      if (envelope.status === 'confirmed_abort') {
        try {
          if (isDirectoryError(callbackError)) throw callbackError;
          fail('storage_unavailable');
        } catch (error) {
          confirmedAborts.add(error as object);
          throw error;
        }
      }
      v.check(
        envelope.status === 'committed' && completed && !failed,
        'commit_unknown',
      );
      const observed = v.snapshot(envelope.value, 'commit_unknown');
      v.check(
        v.canonical(observed) === v.canonical(expected!),
        'commit_unknown',
      );
      return expected!;
    } catch (error) {
      if (isDirectoryError(error) && confirmedAborts.has(error)) throw error;
      fenced = true;
      return fail('commit_unknown');
    }
  };
  const storageIdentity = (raw: IdentityRow | null): IdentityRow | null =>
    raw === null ? null : v.identityRow(raw, namespace, limits.maxRecordBytes);
  const storedIdentity = async (
    tx: DirectoryTx,
    issuer: string,
    subject: string,
  ): Promise<IdentityRow | null> => {
    const row = storageIdentity(await tx.getIdentity(issuer, subject));
    v.check(
      row === null || (row.issuer === issuer && row.subject === subject),
      'storage_unavailable',
    );
    return row;
  };
  const storedLink = async (
    tx: DirectoryTx,
    linkId: string,
  ): Promise<IdentityRow | null> => {
    const row = storageIdentity(await tx.getLink(linkId));
    v.check(row === null || row.linkId === linkId, 'storage_unavailable');
    return row;
  };
  const revision = async (
    tx: DirectoryTx,
    accountId: string,
  ): Promise<number | null> => {
    const raw = await tx.getAccountRevision(accountId);
    return raw === null ? null : v.integer(raw, 'storage_unavailable', 1);
  };
  const storedCommand = async (
    tx: DirectoryTx,
    commandId: string,
  ): Promise<CommandRow | null> => {
    const raw = await tx.getCommand(commandId);
    if (raw === null) return null;
    const value = v.commandRow(raw, namespace, limits.maxRecordBytes);
    v.check(value.commandId === commandId, 'storage_unavailable');
    return value;
  };
  const links = async (
    tx: DirectoryTx,
    accountId: string,
  ): Promise<IdentityRow[]> => {
    const rows = v.array(
      await tx.listLinks(accountId, limits.maxLinksPerAccount),
      limits.maxLinksPerAccount,
      (value) => v.identityRow(value, namespace, limits.maxRecordBytes),
      'storage_unavailable',
    );
    v.check(
      rows.every((row) => row.accountId === accountId) &&
        new Set(rows.map((row) => row.linkId)).size === rows.length,
      'storage_unavailable',
    );
    return rows;
  };
  const route = async (
    issuer: string,
    providerId?: string,
  ): Promise<string | null> => {
    const raw = await port(
      () => settings.canonicalProviderForIssuer(issuer),
      'provider_disabled',
    );
    if (raw === null) return null;
    const configured = v.record<{ providerId: string; revision: string }>(
      raw,
      {
        providerId: (value) => v.text(value, 80, 'provider_disabled', true),
        revision: (value) => v.short(value, 'provider_disabled'),
      },
      'provider_disabled',
    );
    if (providerId !== undefined && configured.providerId !== providerId)
      return null;
    const state = v.record<{ enabled: boolean; revision: string }>(
      await port(
        () => settings.providerState(configured.providerId),
        'provider_disabled',
      ),
      {
        enabled: (value) => v.boolean(value, 'provider_disabled'),
        revision: (value) => v.short(value, 'provider_disabled'),
      },
      'provider_disabled',
    );
    return state.enabled ? configured.providerId : null;
  };
  const requireRoute = async (
    issuer: string,
    providerId: string,
  ): Promise<void> => {
    v.check(await route(issuer, providerId), 'provider_disabled');
  };
  const authorize = async (
    action: 'link' | 'unlink' | 'list' | 'reconcile' | 'guard',
    profile: SessionProfile,
  ): Promise<void> => {
    const grant = v.record<{ allowed: boolean; revision: string }>(
      await port(
        () =>
          settings.authorize({
            action,
            namespace,
            accountId: profile.accountId,
            sessionId: profile.sessionId,
          }),
        'authorization_denied',
      ),
      {
        allowed: (value) => v.boolean(value, 'authorization_denied'),
        revision: (value) => v.short(value, 'authorization_denied'),
      },
      'authorization_denied',
    );
    v.check(grant.allowed, 'authorization_denied');
  };
  const session = async (
    use: SessionUse,
  ): Promise<{ profile: SessionProfile; binding: SessionBinding }> => {
    const profile = v.profile(
      await port(
        () => settings.authenticateSession(v.sessionUse(use)),
        'authentication_unavailable',
      ),
      time(),
    );
    const binding = v.binding(
      await port(
        () => settings.sessionBinding(profile.sessionId),
        'authentication_denied',
      ),
    );
    v.check(
      binding.namespace === namespace &&
        ['accountId', 'sessionId', 'issuer', 'subject', 'providerId'].every(
          (key) =>
            binding[key as keyof SessionBinding] ===
            profile[key as keyof SessionProfile],
        ),
      'authentication_denied',
    );
    await authorize('guard', profile);
    await requireRoute(profile.issuer, profile.providerId);
    return { profile, binding };
  };
  const actorRow = async (
    tx: DirectoryTx,
    source: { profile: SessionProfile; binding: SessionBinding },
  ): Promise<Actor> => {
    const { profile, binding } = source;
    const row = await storedIdentity(tx, profile.issuer, profile.subject);
    v.check(
      row &&
        row.status === 'active' &&
        row.accountId === profile.accountId &&
        row.providerId === profile.providerId &&
        row.linkId === binding.linkId &&
        row.generation === binding.generation,
      'authentication_denied',
    );
    const current = await revision(tx, profile.accountId);
    v.check(current !== null, 'authentication_denied');
    return { profile, binding, row: row!, revision: current! };
  };
  const guard = async (use: SessionUse): Promise<Actor> => {
    const source = await session(use);
    return atomic((tx) => actorRow(tx, source));
  };
  const freshProof = async (input: ProofInput): Promise<Identity> => {
    const raw = await port(
      () => settings.verifyProof(v.proof(input)),
      'authentication_unavailable',
    );
    const result = v.identity(raw, time(), 'authentication_denied');
    v.check(
      time() - result.authTime <= limits.maxFreshProofAgeMs,
      'authentication_denied',
    );
    await requireRoute(result.issuer, input.providerId);
    return result;
  };
  const approval = async (
    proof: Identity,
    enrollmentRef: string,
    horizon: v.Horizon,
  ): Promise<{ accountId: string; consentId: string }> => {
    const code = 'authorization_denied';
    const raw = await port(
      () =>
        settings.provisioningPolicy({
          namespace,
          enrollmentRef,
          verifiedIdentity: { ...proof, methods: [...proof.methods] },
          commandId: horizon.commandId,
        }),
      code,
    );
    const value = v.record<{
      accountId: string;
      approvalId: string;
      commandId: string;
      issuedAt: number;
      expiresAt: number;
    }>(
      raw,
      {
        accountId: (item) => v.account(item, code),
        approvalId: (item) => v.short(item, code),
        commandId: (item) => v.text(item, 60, code),
        issuedAt: (item) => v.integer(item, code),
        expiresAt: (item) => v.integer(item, code),
      },
      code,
    );
    v.check(
      value.commandId === horizon.commandId &&
        value.issuedAt === horizon.issuedAt &&
        value.expiresAt === horizon.deadline &&
        time() < value.expiresAt,
      code,
    );
    return { accountId: value.accountId, consentId: value.approvalId };
  };
  const consent = async (
    receipt: string,
    intent: Omit<Intent, 'consentId' | 'digest'>,
  ): Promise<string> => {
    const code = 'consent_denied';
    const target =
      intent.action === 'link'
        ? {
            providerId: intent.providerId,
            issuer: intent.target!.issuer,
            subject: intent.target!.subject,
          }
        : { providerId: intent.providerId, linkId: intent.linkId! };
    const raw = await port(
      () =>
        settings.verifyConsent({
          receipt,
          action: intent.action as 'link' | 'unlink',
          accountId: intent.accountId,
          commandId: intent.horizon.commandId,
          target,
        }),
      code,
    );
    const value = v.record<{
      consentId: string;
      commandId: string;
      issuedAt: number;
      expiresAt: number;
    }>(
      raw,
      {
        consentId: (item) => v.short(item, code),
        commandId: (item) => v.text(item, 60, code),
        issuedAt: (item) => v.integer(item, code),
        expiresAt: (item) => v.integer(item, code),
      },
      code,
    );
    v.check(
      value.commandId === intent.horizon.commandId &&
        value.issuedAt === intent.horizon.issuedAt &&
        value.expiresAt === intent.horizon.deadline &&
        time() < value.expiresAt,
      code,
    );
    return value.consentId;
  };
  const digest = (intent: Omit<Intent, 'digest'>): string =>
    hash({
      namespace,
      accountId: intent.accountId,
      action: intent.action,
      providerId: intent.providerId,
      target: intent.target
        ? { issuer: intent.target.issuer, subject: intent.target.subject }
        : { linkId: intent.linkId },
      consentId: intent.consentId,
      commandId: intent.horizon.commandId,
    });
  const assertReceipt = (receipt: CommandRow, intent: Intent): void => {
    v.check(
      receipt.accountId === intent.accountId &&
        receipt.action === intent.action &&
        receipt.intentDigest === intent.digest &&
        receipt.expiresAt === intent.horizon.deadline,
      'command_conflict',
    );
  };
  const preflight = async (tx: DirectoryTx, intent: Intent): Promise<Plan> => {
    if (intent.actor) {
      await actorRow(tx, intent.actor);
    }
    const receipt = await storedCommand(tx, intent.horizon.commandId);
    if (receipt) {
      assertReceipt(receipt, intent);
      return { target: null, revision: null, receipt, links: [] };
    }
    const target = intent.target
      ? await storedIdentity(tx, intent.target.issuer, intent.target.subject)
      : await storedLink(tx, intent.linkId!);
    if (intent.action === 'unlink')
      v.check(
        target &&
          target.accountId === intent.accountId &&
          target.status === 'active',
        'identity_conflict',
      );
    else if (target)
      v.check(
        intent.action === 'link' &&
          target.accountId === intent.accountId &&
          target.status === 'unlinked' &&
          target.providerId === intent.providerId,
        'identity_conflict',
      );
    const current = await revision(tx, intent.accountId);
    if (intent.actor)
      v.check(current === intent.actor.revision, 'identity_conflict');
    const used = await tx.getConsent(intent.consentId);
    if (used !== null) {
      const parsed = v.consentRow(used, namespace, limits.maxRecordBytes);
      v.check(parsed.consentId === intent.consentId, 'storage_unavailable');
      fail('consent_denied');
    }
    const count = v.integer(await tx.countRows(), 'storage_unavailable');
    const linkCount = v.integer(
      await tx.countLinks(intent.accountId),
      'storage_unavailable',
    );
    const commands = v.integer(
      await tx.countCommands(intent.accountId),
      'storage_unavailable',
    );
    const pending = v.integer(
      await tx.countPendingEvents(),
      'storage_unavailable',
    );
    v.check(
      count <= limits.maxRowsPerNamespace - 5 &&
        linkCount <= limits.maxLinksPerAccount &&
        (target !== null || linkCount < limits.maxLinksPerAccount) &&
        commands < limits.maxCommandReceiptsPerAccount &&
        pending < limits.maxPendingEvents,
      'capacity_exceeded',
    );
    return {
      target,
      revision: current,
      receipt: null,
      links:
        intent.action === 'unlink' ? await links(tx, intent.accountId) : [],
    };
  };
  const draw = (): string => {
    try {
      const bytes = v.bytes(settings.randomBytes(32), 32, 32, 'invalid_config');
      return Buffer.from(bytes).toString('base64url');
    } catch {
      return fail('invalid_config');
    }
  };
  const sized = (rows: unknown[]): void => {
    v.check(
      rows.every(
        (row) =>
          Buffer.byteLength(v.canonical(row), 'utf8') <= limits.maxRecordBytes,
      ),
      'capacity_exceeded',
    );
  };
  const terminal = async (
    kind: 'settle' | 'releaseConfirmedAbort',
    reservationId: string,
    commandId: string,
  ): Promise<void> => {
    const result = await port(
      () => settings.capacity[kind](reservationId, commandId),
      'commit_unknown',
    );
    v.check(result === undefined, 'commit_unknown');
  };
  const replay = async (receipt: CommandRow): Promise<CommandResult> => {
    try {
      await terminal('settle', receipt.reservationId, receipt.commandId);
    } catch {
      fenced = true;
      return fail('commit_unknown');
    }
    return { ...receipt.result, replay: true };
  };
  const mutate = async (
    intent: Intent,
    recheck: () => Promise<void>,
  ): Promise<CommandResult> => {
    const plan = await atomic((tx) => preflight(tx, intent));
    if (plan.receipt) return replay(plan.receipt);
    if (intent.action === 'unlink') {
      const usable = await Promise.all(
        plan.links
          .filter(
            (row) => row.linkId !== intent.linkId && row.status === 'active',
          )
          .map((row) => route(row.issuer, row.providerId)),
      );
      v.check(usable.some(Boolean), 'last_method');
    }
    const at = time();
    const linkId = plan.target?.linkId ?? draw();
    const eventId = draw();
    const revisionNumber = plan.revision === null ? 1 : next(plan.revision);
    const result: CommandResult = {
      status: (
        {
          provision: 'provisioned',
          link: 'linked',
          unlink: 'unlinked',
        } as const
      )[intent.action],
      accountId: intent.accountId,
      linkId,
      revision: revisionNumber,
      replay: false,
    };
    const identity: IdentityRow = plan.target
      ? {
          ...plan.target,
          status: intent.action === 'unlink' ? 'unlinked' : 'active',
          generation: next(plan.target.generation),
          unlinkedAt: intent.action === 'unlink' ? at : null,
        }
      : {
          namespace,
          issuer: intent.target!.issuer,
          subject: intent.target!.subject,
          providerId: intent.providerId,
          accountId: intent.accountId,
          linkId,
          status: 'active',
          generation: 1,
          linkedAt: at,
          unlinkedAt: null,
        };
    const receipt = {
      namespace,
      commandId: intent.horizon.commandId,
      accountId: intent.accountId,
      action: intent.action,
      intentDigest: intent.digest,
      result,
      reservationId: 'x'.repeat(128),
      eventId,
      expiresAt: intent.horizon.deadline,
    };
    const consumed = {
      namespace,
      consentId: intent.consentId,
      commandId: intent.horizon.commandId,
      expiresAt: intent.horizon.deadline,
    };
    const event = {
      eventId,
      namespace,
      kind: (
        {
          provision: 'identity_provisioned',
          link: 'identity_linked',
          unlink: 'identity_unlinked',
        } as const
      )[intent.action],
      accountId: intent.accountId,
      linkId,
      providerId: intent.providerId,
      revision: revisionNumber,
      at,
      commandId: intent.horizon.commandId,
      delivery: 'pending' as const,
    };
    sized([
      identity,
      { namespace, accountId: intent.accountId, revision: revisionNumber },
      receipt,
      consumed,
      event,
    ]);
    const quote = v.quote(
      await port(
        () =>
          settings.capacity.quoteGrowth({
            namespace,
            accountId: intent.accountId,
            commandId: intent.horizon.commandId,
            intentDigest: intent.digest,
            logicalFootprint: [
              'identity',
              'accountRevision',
              'command',
              'consent',
              'event',
            ].map((kind) => ({
              kind: kind as
                | 'identity'
                | 'accountRevision'
                | 'command'
                | 'consent'
                | 'event',
              upperBytes: limits.maxRecordBytes,
            })),
            replayUntil: intent.horizon.deadline,
            class: 'auth-core',
          }),
        'capacity_exceeded',
      ),
      5 * limits.maxRecordBytes,
      intent.horizon.deadline,
    );
    const reservation = v.record<{ reservationId: string }>(
      await port(
        () =>
          settings.capacity.reserveGrowth({
            namespace,
            accountId: intent.accountId,
            commandId: intent.horizon.commandId,
            intentDigest: intent.digest,
            quote: { ...quote },
            class: 'auth-core',
          }),
        'capacity_exceeded',
      ),
      { reservationId: (value) => v.short(value, 'capacity_exceeded') },
      'capacity_exceeded',
    );
    receipt.reservationId = reservation.reservationId;
    let checkError: unknown;
    try {
      v.check(!fenced, 'commit_unknown');
      v.horizon(intent.horizon.commandId, time(), limits.replayWindowMs);
      await recheck();
      if (intent.action === 'unlink') {
        const usable = await Promise.all(
          plan.links
            .filter(
              (row) => row.linkId !== intent.linkId && row.status === 'active',
            )
            .map((row) => route(row.issuer, row.providerId)),
        );
        v.check(usable.some(Boolean), 'last_method');
      }
    } catch (error) {
      checkError = error;
    }
    let committed: CommandResult;
    try {
      committed = await atomic(async (tx) => {
        if (checkError) throw checkError;
        v.check(!fenced, 'commit_unknown');
        const current = await preflight(tx, intent);
        if (current.receipt) {
          v.check(
            current.receipt.reservationId === reservation.reservationId,
            'command_conflict',
          );
          return { ...current.receipt.result, replay: true };
        }
        v.check(
          current.revision === plan.revision &&
            v.canonical(current.target) === v.canonical(plan.target),
          'identity_conflict',
        );
        v.check(
          (await storedLink(tx, linkId)) === null || plan.target !== null,
          'identity_conflict',
        );
        const writes = [
          () =>
            plan.target
              ? tx.updateIdentity(plan.target.generation, identity)
              : tx.insertIdentity(identity),
          () =>
            tx.putAccountRevision(
              intent.accountId,
              plan.revision,
              revisionNumber,
            ),
          () => tx.insertConsent(consumed),
          () => tx.insertCommand(receipt),
          () => tx.insertEvent(event),
        ];
        for (const write of writes)
          v.check(
            v.boolean(await write(), 'storage_unavailable'),
            'identity_conflict',
          );
        return { ...result };
      });
    } catch (error) {
      // Only an explicit confirmed_abort reaches this branch without commit_unknown.
      if (isDirectoryError(error) && confirmedAborts.has(error)) {
        try {
          await terminal(
            'releaseConfirmedAbort',
            reservation.reservationId,
            intent.horizon.commandId,
          );
        } catch {
          fenced = true;
          return fail('commit_unknown');
        }
        throw error;
      }
      fenced = true;
      return fail('commit_unknown');
    }
    try {
      await terminal(
        'settle',
        reservation.reservationId,
        intent.horizon.commandId,
      );
    } catch {
      fenced = true;
      return fail('commit_unknown');
    }
    return committed;
  };
  const write = async (
    work: () => Promise<CommandResult>,
  ): Promise<CommandResult> => {
    v.check(!fenced, 'commit_unknown');
    v.check(concurrent < limits.maxConcurrentCommands, 'capacity_exceeded');
    concurrent++;
    try {
      return await work();
    } finally {
      concurrent--;
    }
  };
  const protectedMutation = async (
    raw: unknown,
    action: 'link' | 'unlink',
  ): Promise<CommandResult> =>
    write(async () => {
      const input = v.data(
        raw,
        [
          'sessionUse',
          'currentProof',
          action === 'link' ? 'targetProof' : 'linkId',
          'consent',
          'commandId',
        ],
        'invalid_input',
      );
      const horizon = v.horizon(input.commandId, time(), limits.replayWindowMs);
      const use = v.sessionUse(input.sessionUse);
      const currentProof = v.proof(input.currentProof);
      const targetProof = action === 'link' ? v.proof(input.targetProof) : null;
      const linkId =
        action === 'unlink' ? v.id(input.linkId, 'invalid_input') : null;
      const secret = v.text(input.consent, 4096, 'invalid_input');
      const actor = await guard(use);
      const current = await freshProof(currentProof);
      v.check(
        current.issuer === actor.profile.issuer &&
          current.subject === actor.profile.subject &&
          currentProof.providerId === actor.profile.providerId,
        'authentication_denied',
      );
      const target = targetProof ? await freshProof(targetProof) : null;
      const targetRow = linkId
        ? await atomic((tx) => storedLink(tx, linkId))
        : null;
      if (action === 'unlink')
        v.check(
          targetRow && targetRow.accountId === actor.profile.accountId,
          'identity_conflict',
        );
      const partial = {
        action,
        horizon,
        accountId: actor.profile.accountId,
        target,
        providerId: targetProof
          ? targetProof.providerId
          : targetRow!.providerId,
        linkId,
        actor,
      };
      await authorize(action, actor.profile);
      const consentId = await consent(secret, partial);
      const intent = { ...partial, consentId, digest: '' };
      intent.digest = digest(intent);
      return mutate(intent, async () => {
        const currentActor = await guard(use);
        v.check(
          v.canonical(currentActor) === v.canonical(actor),
          'authentication_denied',
        );
        await authorize(action, currentActor.profile);
        v.check(
          time() - current.authTime <= limits.maxFreshProofAgeMs,
          'authentication_denied',
        );
        if (target) {
          v.check(
            time() - target.authTime <= limits.maxFreshProofAgeMs,
            'authentication_denied',
          );
          await requireRoute(target.issuer, intent.providerId);
        }
        v.check(
          (await consent(secret, partial)) === consentId,
          'consent_denied',
        );
      });
    });
  return {
    async resolveIdentity(raw) {
      const verified = v.identity(raw, time(), 'invalid_input');
      const providerId = await route(verified.issuer);
      if (!providerId) return null;
      return atomic(async (tx) => {
        const row = await storedIdentity(tx, verified.issuer, verified.subject);
        return row && row.status === 'active' && row.providerId === providerId
          ? { accountId: row.accountId }
          : null;
      });
    },
    async provision(raw) {
      return write(async () => {
        const input = v.data(
          raw,
          ['proof', 'enrollmentRef', 'commandId'],
          'invalid_input',
        );
        const horizon = v.horizon(
          input.commandId,
          time(),
          limits.replayWindowMs,
        );
        const proof = v.proof(input.proof);
        const enrollmentRef = v.text(
          input.enrollmentRef,
          4096,
          'invalid_input',
        );
        const target = await freshProof(proof);
        const approved = await approval(target, enrollmentRef, horizon);
        const intent: Intent = {
          action: 'provision',
          horizon,
          ...approved,
          target,
          providerId: proof.providerId,
          linkId: null,
          actor: null,
          digest: '',
        };
        intent.digest = digest(intent);
        return mutate(intent, async () => {
          v.check(
            time() - target.authTime <= limits.maxFreshProofAgeMs,
            'authentication_denied',
          );
          await requireRoute(target.issuer, proof.providerId);
          v.check(
            v.canonical(await approval(target, enrollmentRef, horizon)) ===
              v.canonical(approved),
            'authorization_denied',
          );
        });
      });
    },
    async link(raw) {
      return protectedMutation(raw, 'link');
    },
    async unlink(raw) {
      return protectedMutation(raw, 'unlink');
    },
    async list(raw) {
      const input = v.data(raw, ['sessionUse'], 'invalid_input');
      const actor = await guard(v.sessionUse(input.sessionUse));
      await authorize('list', actor.profile);
      const listing = await atomic(async (tx) => {
        const current = await actorRow(tx, actor);
        return {
          revision: current.revision,
          rows: await links(tx, actor.profile.accountId),
        };
      });
      const views = await Promise.all(
        listing.rows.map(async (row) => ({
          linkId: row.linkId,
          providerId: row.providerId,
          issuer: row.issuer,
          usable:
            row.status === 'active' &&
            !!(await route(row.issuer, row.providerId)),
          linkedAt: row.linkedAt,
        })),
      );
      return { revision: listing.revision, links: views };
    },
    async reconcile(raw) {
      const input = v.data(raw, ['scope', 'commandId'], 'invalid_input');
      const horizon = v.horizon(input.commandId, time(), limits.replayWindowMs);
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(
          input.scope as object,
          'kind',
        );
      } catch {
        fail('invalid_input');
      }
      v.check(descriptor && 'value' in descriptor, 'invalid_input');
      const kind = v.oneOf(
        descriptor!.value,
        ['session', 'provision'],
        'invalid_input',
      );
      let accountId: string;
      let provisionIntent: Intent | null = null;
      if (kind === 'session') {
        const scope = v.data(
          input.scope,
          ['kind', 'sessionUse'],
          'invalid_input',
        );
        const actor = await guard(v.sessionUse(scope.sessionUse));
        await authorize('reconcile', actor.profile);
        accountId = actor.profile.accountId;
      } else {
        const scope = v.data(
          input.scope,
          ['kind', 'proof', 'enrollmentRef'],
          'invalid_input',
        );
        const proof = v.proof(scope.proof);
        const target = await freshProof(proof);
        const approved = await approval(
          target,
          v.text(scope.enrollmentRef, 4096, 'invalid_input'),
          horizon,
        );
        accountId = approved.accountId;
        provisionIntent = {
          action: 'provision',
          horizon,
          ...approved,
          target,
          providerId: proof.providerId,
          actor: null,
          linkId: null,
          digest: '',
        };
        provisionIntent.digest = digest(provisionIntent);
      }
      const receipt = await atomic(async (tx) => {
        const found = await storedCommand(tx, horizon.commandId);
        if (found) {
          v.check(
            found.accountId === accountId &&
              found.expiresAt === horizon.deadline,
            'command_conflict',
          );
          if (provisionIntent) assertReceipt(found, provisionIntent);
        }
        return found;
      });
      return receipt ? replay(receipt) : null;
    },
    async assertCurrentLink(raw): Promise<GuardResult> {
      const input = v.data(raw, ['sessionUse'], 'invalid_input');
      const actor = await guard(v.sessionUse(input.sessionUse));
      return {
        accountId: actor.profile.accountId,
        linkId: actor.row.linkId,
        generation: actor.row.generation,
        accountRevision: actor.revision,
      };
    },
  };
}
