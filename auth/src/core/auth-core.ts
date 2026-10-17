import { createHash } from 'node:crypto';
import { fail, isCoreError } from './auth-errors.js';
import {
  contextFor,
  exactInput,
  resolvedAccount,
  safeTime,
  validateConfig,
  validText,
  verifiedIdentity,
} from './auth-validation.js';
import type {
  AuthCore,
  AuthCoreOptions,
  AuthProfile,
  IssuedSession,
  RequestContext,
  SessionEvent,
  SessionRecord,
  SessionTransaction,
  TokenEntry,
} from './auth-types.js';

const hash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
const profile = (record: SessionRecord): AuthProfile => ({
  accountId: record.accountId,
  sessionId: record.sessionId,
  issuer: record.issuer,
  subject: record.subject,
  providerId: record.providerId,
  authTime: record.authTime,
  methods: [...record.methods],
  expiresAt: record.expiresAt,
});
const eventFor = (
  record: SessionRecord,
  kind: SessionEvent['kind'],
  at: number,
  reason: string,
): SessionEvent => ({
  eventId: hash(
    JSON.stringify([record.namespace, record.sessionId, record.revision, kind]),
  ),
  namespace: record.namespace,
  kind,
  at,
  sessionId: record.sessionId,
  revision: record.revision,
  reason,
});
const nextRevision = (value: number): number => {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value >= Number.MAX_SAFE_INTEGER
  )
    fail('storage_unavailable');
  return value + 1;
};

export function createAuthCore(options: AuthCoreOptions): AuthCore {
  let settings: {
    namespace: string;
    origins: string[];
    providers: AuthCoreOptions['providers'];
    absoluteTtlMs: number;
    idleTtlMs: number;
    resolveIdentity: AuthCoreOptions['resolveIdentity'];
    now: AuthCoreOptions['now'];
    randomBytes: AuthCoreOptions['randomBytes'];
    transaction: AuthCoreOptions['sessions']['transaction'];
  };
  try {
    if (!(options.providers instanceof Map)) fail('invalid_config');
    const origins = [...options.allowedOrigins];
    const providers = new Map(options.providers);
    const sessions = options.sessions;
    settings = {
      namespace: options.namespace,
      origins,
      providers,
      absoluteTtlMs: options.absoluteTtlMs,
      idleTtlMs: options.idleTtlMs,
      resolveIdentity: options.resolveIdentity,
      now: options.now,
      randomBytes: options.randomBytes,
      transaction: sessions.transaction.bind(sessions),
    };
    validateConfig({
      namespace: settings.namespace,
      allowedOrigins: settings.origins,
      providers: settings.providers,
      absoluteTtlMs: settings.absoluteTtlMs,
      idleTtlMs: settings.idleTtlMs,
      resolveIdentity: settings.resolveIdentity,
      sessions: { transaction: settings.transaction },
      now: settings.now,
      randomBytes: settings.randomBytes,
    });
  } catch (error) {
    if (isCoreError(error)) throw error;
    return fail('invalid_config');
  }
  const {
    namespace,
    origins,
    providers,
    absoluteTtlMs,
    idleTtlMs,
    resolveIdentity,
    now,
    randomBytes,
    transaction,
  } = settings;
  const draw = (): string => {
    let bytes: Uint8Array;
    try {
      bytes = randomBytes(32);
    } catch {
      return fail('invalid_config');
    }
    if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 32)
      fail('invalid_config');
    return Buffer.from(bytes).toString('base64url');
  };
  const time = (
    code: 'invalid_config' | 'session_expired' = 'session_expired',
  ): number => {
    try {
      return safeTime(now(), code);
    } catch (error) {
      if (isCoreError(error)) throw error;
      return fail(code);
    }
  };
  const atomic = async <T>(
    work: (tx: SessionTransaction) => Promise<T>,
  ): Promise<T> => {
    const portCall = async <R>(call: () => Promise<R>): Promise<R> => {
      try {
        return await call();
      } catch {
        return fail('storage_unavailable');
      }
    };
    try {
      return await transaction((tx) =>
        work({
          getToken: (namespace, tokenHash) =>
            portCall(() => tx.getToken(namespace, tokenHash)),
          getSession: (namespace, sessionId) =>
            portCall(() => tx.getSession(namespace, sessionId)),
          putToken: (entry) => portCall(() => tx.putToken(entry)),
          putSession: (record) => portCall(() => tx.putSession(record)),
          insertSession: (record) => portCall(() => tx.insertSession(record)),
          insertToken: (entry) => portCall(() => tx.insertToken(entry)),
          putEvent: (event) => portCall(() => tx.putEvent(event)),
          listSessions: (namespace, accountId) =>
            portCall(() => tx.listSessions(namespace, accountId)),
        }),
      );
    } catch (error) {
      if (isCoreError(error)) throw error;
      return fail('storage_unavailable');
    }
  };
  const writeEvent = async (
    tx: SessionTransaction,
    record: SessionRecord,
    kind: SessionEvent['kind'],
    at: number,
    reason: string,
  ): Promise<void> => {
    if ((await tx.putEvent(eventFor(record, kind, at, reason))) !== true)
      fail('storage_unavailable');
  };
  const checkCsrf = (context: RequestContext, record: SessionRecord): void => {
    if (
      context.transport === 'cookie' &&
      !['GET', 'HEAD', 'OPTIONS'].includes(context.method) &&
      (!validText(context.csrf) ||
        !record.csrfHash ||
        hash(context.csrf) !== record.csrfHash)
    )
      fail('csrf_denied');
  };
  const checkedSession = async (
    tx: SessionTransaction,
    token: string,
    context: RequestContext,
    at: number,
  ): Promise<{ entry: TokenEntry; record: SessionRecord }> => {
    const entry = await tx.getToken(namespace, hash(token));
    if (!entry || entry.namespace !== namespace) fail('session_denied');
    const record = await tx.getSession(namespace, entry.sessionId);
    if (
      !record ||
      record.namespace !== namespace ||
      record.sessionId !== entry.sessionId ||
      record.transport !== context.transport ||
      record.revokedAt !== null
    )
      fail('session_denied');
    if (
      at < record.createdAt ||
      at < record.lastSeenAt ||
      at < record.authTime ||
      at >= record.expiresAt ||
      at >= record.lastSeenAt + idleTtlMs
    )
      fail('session_expired');
    checkCsrf(context, record);
    return { entry, record };
  };
  const tokenInput = (
    raw: unknown,
    operation: 'authenticate' | 'refresh' | 'logout',
  ): { token: string; context: RequestContext } => {
    const input = exactInput(raw, ['token', 'context'], ['token', 'context']);
    if (!validText(input.token, 8192)) fail('invalid_input');
    return {
      token: input.token,
      context: contextFor(input.context, operation, origins),
    };
  };
  const login: AuthCore['login'] = async (raw) => {
    const input = exactInput(
      raw,
      ['providerId', 'proof', 'context'],
      ['providerId', 'proof', 'context'],
    );
    if (!validText(input.providerId, 80)) fail('invalid_input');
    const context = contextFor(input.context, 'login', origins);
    const verify = providers.get(input.providerId);
    if (!verify) fail('authentication_denied');
    const at = time('invalid_config');
    let claim: unknown;
    try {
      claim = await verify(input.proof);
    } catch {
      return fail('authentication_unavailable');
    }
    const identity = verifiedIdentity(claim, at);
    let account: unknown;
    try {
      account = await resolveIdentity(identity);
    } catch {
      return fail('authentication_unavailable');
    }
    const accountId = resolvedAccount(account);
    const sessionId = draw(),
      token = draw(),
      csrfToken = context.transport === 'cookie' ? draw() : undefined;
    if (sessionId === token || sessionId === csrfToken || token === csrfToken)
      fail('credential_collision');
    const expiresAt = at + absoluteTtlMs;
    if (!Number.isSafeInteger(expiresAt)) fail('invalid_config');
    const record: SessionRecord = {
      namespace,
      sessionId,
      accountId,
      issuer: identity.issuer,
      subject: identity.subject,
      providerId: input.providerId,
      authTime: identity.authTime,
      methods: [...identity.methods],
      transport: context.transport,
      createdAt: at,
      lastSeenAt: at,
      expiresAt,
      csrfHash: csrfToken ? hash(csrfToken) : null,
      revokedAt: null,
      revision: 1,
    };
    await atomic(async (tx) => {
      if ((await tx.insertSession(record)) !== true)
        fail('credential_collision');
      if (
        (await tx.insertToken({
          namespace,
          tokenHash: hash(token),
          sessionId,
          state: 'current',
        })) !== true
      )
        fail('credential_collision');
      await writeEvent(tx, record, 'session_created', at, 'login');
    });
    return csrfToken
      ? { token, csrfToken, profile: profile(record) }
      : { token, profile: profile(record) };
  };
  const authenticate: AuthCore['authenticate'] = async (raw) => {
    const { token, context } = tokenInput(raw, 'authenticate');
    const at = time();
    return atomic(async (tx) => {
      const { entry, record } = await checkedSession(tx, token, context, at);
      if (entry.state !== 'current') fail('session_denied');
      if (at > record.lastSeenAt)
        await tx.putSession({ ...record, lastSeenAt: at });
      return profile(record);
    });
  };
  const refresh: AuthCore['refresh'] = async (raw) => {
    const { token, context } = tokenInput(raw, 'refresh');
    const at = time();
    const outcome = await atomic(async (tx) => {
      const { entry, record } = await checkedSession(tx, token, context, at);
      if (entry.state === 'rotated') {
        const revoked = {
          ...record,
          revokedAt: at,
          revision: nextRevision(record.revision),
        };
        await tx.putSession(revoked);
        await writeEvent(tx, revoked, 'session_reused', at, 'refresh_reuse');
        return { reused: true } as const;
      }
      const nextToken = draw();
      if (nextToken === token || nextToken === record.sessionId)
        fail('credential_collision');
      const nextRecord = {
        ...record,
        lastSeenAt: at,
        revision: nextRevision(record.revision),
      };
      await tx.putToken({ ...entry, state: 'rotated' });
      if (
        (await tx.insertToken({
          namespace,
          tokenHash: hash(nextToken),
          sessionId: record.sessionId,
          state: 'current',
        })) !== true
      )
        fail('credential_collision');
      await tx.putSession(nextRecord);
      await writeEvent(tx, nextRecord, 'session_refreshed', at, 'refresh');
      const issued: IssuedSession = {
        token: nextToken,
        profile: profile(nextRecord),
      };
      return {
        reused: false,
        issued:
          context.transport === 'cookie'
            ? { ...issued, csrfToken: context.csrf }
            : issued,
      } as const;
    });
    if (outcome.reused) fail('session_reused');
    return outcome.issued;
  };
  const logout: AuthCore['logout'] = async (raw) => {
    const { token, context } = tokenInput(raw, 'logout');
    const at = time();
    return atomic(async (tx) => {
      const entry = await tx.getToken(namespace, hash(token));
      if (!entry) return { revoked: false };
      const record = await tx.getSession(namespace, entry.sessionId);
      if (
        !record ||
        record.namespace !== namespace ||
        record.transport !== context.transport
      )
        fail('session_denied');
      checkCsrf(context, record);
      if (record.revokedAt !== null) return { revoked: false };
      if (
        at < record.createdAt ||
        at < record.lastSeenAt ||
        at >= record.expiresAt ||
        at >= record.lastSeenAt + idleTtlMs
      )
        fail('session_expired');
      if (entry.state !== 'current') fail('session_denied');
      const revoked = {
        ...record,
        revokedAt: at,
        revision: nextRevision(record.revision),
      };
      await tx.putSession(revoked);
      await writeEvent(tx, revoked, 'session_revoked', at, 'logout');
      return { revoked: true };
    });
  };
  const revokeAll: AuthCore['revokeAll'] = async (accountId) => {
    if (!validText(accountId, 512)) fail('invalid_input');
    const at = time();
    return atomic(async (tx) => {
      let revoked = 0;
      for (const record of await tx.listSessions(namespace, accountId)) {
        if (
          record.namespace !== namespace ||
          record.accountId !== accountId ||
          record.revokedAt !== null
        )
          continue;
        const next = {
          ...record,
          revokedAt: at,
          revision: nextRevision(record.revision),
        };
        await tx.putSession(next);
        await writeEvent(tx, next, 'session_revoked', at, 'revoke_all');
        revoked++;
      }
      return { revoked };
    });
  };
  return { login, authenticate, refresh, logout, revokeAll };
}
