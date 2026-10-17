import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const HERE = new URL('.', import.meta.url);
export const candidatePath = process.env.YALC_AUTH_DURABLE_CANDIDATE
  ? resolve(process.env.YALC_AUTH_DURABLE_CANDIDATE)
  : new URL('unimplemented-baseline.mjs', HERE).pathname;
export const sqliteModule = process.env.YALC_SQLITE3_MODULE;
export const scratchRoot = process.env.YALC_AUTH_DURABLE_SCRATCH;

export async function candidate() {
  assert.ok(isAbsolute(candidatePath), 'candidate must be an absolute ESM path');
  const module = await import(pathToFileURL(candidatePath).href);
  assert.equal(typeof module.openAuthSqliteStore, 'function');
  return module.openAuthSqliteStore;
}

export function sqlite3() {
  assert.ok(sqliteModule && isAbsolute(sqliteModule), 'YALC_SQLITE3_MODULE must be an absolute installed sqlite3 entry');
  const driver = createRequire(import.meta.url)(sqliteModule);
  assert.equal(typeof driver.Database, 'function');
  return driver;
}

export async function scratch(work) {
  assert.ok(scratchRoot && isAbsolute(scratchRoot), 'YALC_AUTH_DURABLE_SCRATCH must be an absolute scratch root');
  const dir = await mkdtemp(join(scratchRoot, 'ds-'));
  try { return await work({ dir, databasePath: join(dir, 'auth.sqlite') }); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

export const limits = Object.freeze({
  maxLogicalRowsPerNamespace: 100,
  maxRowBytes: 16_384,
  maxLogicalBytesPerNamespace: 1_000_000,
  maxPendingOutboxPerNamespace: 20,
  maxQueueDepth: 8,
  busyTimeoutMs: 1_000,
  transactionTimeoutMs: 2_000,
});

export function holdRecovery() { return { reconcile: async () => ({ status: 'hold' }) }; }
export function options(databasePath, mode = 'create', overrides = {}) {
  return { mode, databasePath, namespace: 'tenant-a', limits: { ...limits, ...overrides }, recovery: holdRecovery() };
}
export const id43 = (kind, suffix = '1') => createHash('sha256').update(`${kind}:${suffix}`).digest('base64url');
export const digest64 = (kind, suffix = '1') => createHash('sha256').update(`${kind}:${suffix}`).digest('hex');
export const commandId = (suffix = '1') => `1.${id43('command', suffix)}`;
export function token(suffix = '1') { return { namespace: 'tenant-a', tokenHash: digest64('token', suffix), sessionId: id43('session', suffix), state: 'current' }; }
export function session(suffix = '1', changes = {}) {
  return { namespace: 'tenant-a', issuer: 'issuer-a', subject: `subject-${suffix}`, authTime: 1,
    methods: ['proof'], accountId: `account-${suffix}`, sessionId: id43('session', suffix),
    providerId: 'provider-a', expiresAt: 10_000, transport: 'bearer', createdAt: 1,
    lastSeenAt: 1, csrfHash: null, revokedAt: null, revision: 1, ...changes };
}
export function sessionEvent(suffix = '1', changes = {}) {
  return { eventId: digest64('session-event', suffix), namespace: 'tenant-a', kind: 'session_created',
    at: 1, sessionId: id43('session', suffix), revision: 1, reason: 'test', ...changes };
}
export function identity(suffix = '1', changes = {}) {
  return { namespace: 'tenant-a', issuer: 'issuer-a', subject: `subject-${suffix}`,
    providerId: 'provider-a', accountId: `account-${suffix}`, linkId: id43('link', suffix),
    status: 'active', generation: 1, linkedAt: 1, unlinkedAt: null, ...changes };
}
export function command(suffix = '1', changes = {}) {
  return { namespace: 'tenant-a', commandId: commandId(suffix), accountId: `account-${suffix}`,
    action: 'link', intentDigest: digest64('intent', suffix), result: { status: 'linked',
      accountId: `account-${suffix}`, linkId: id43('link', suffix), revision: 1, replay: false },
    reservationId: `reserve-${suffix}`, eventId: id43('directory-event', suffix), expiresAt: 10_000, ...changes };
}
export function consent(suffix = '1') { return { namespace: 'tenant-a', consentId: `consent-${suffix}`, commandId: commandId(suffix), expiresAt: 10_000 }; }
export function directoryEvent(suffix = '1', changes = {}) {
  return { namespace: 'tenant-a', eventId: id43('directory-event', suffix), kind: 'identity_linked',
    accountId: `account-${suffix}`, linkId: id43('link', suffix), providerId: 'provider-a',
    revision: 1, at: 1, commandId: commandId(suffix), delivery: 'pending', ...changes };
}

export async function directoryCommitted(store, work, namespace = 'tenant-a') {
  const outcome = await store.directory.transaction(namespace, work);
  assert.equal(Object.getPrototypeOf(outcome), Object.prototype);
  assert.deepEqual(Reflect.ownKeys(outcome).sort(), ['status', 'value']);
  assert.equal(outcome.status, 'committed');
  return outcome.value;
}

export function child(mode, args = {}, envExtra = {}) {
  const childPath = new URL('process-child.mjs', HERE).pathname;
  const env = { PATH: process.env.PATH ?? '/usr/bin:/bin',
    YALC_AUTH_DURABLE_CANDIDATE: candidatePath,
    YALC_SQLITE3_MODULE: sqliteModule ?? '',
    YALC_AUTH_DURABLE_SCRATCH: scratchRoot ?? '',
    ...envExtra };
  const preload = envExtra.DS_ACK_RECEIPT ? ['--require', new URL('ack-intercept.cjs', HERE).pathname]
    : envExtra.DS_SQL_FAULT_RECEIPT ? ['--require', new URL('sql-fault.cjs', HERE).pathname] : [];
  const proc = spawn(process.execPath, [...preload, childPath, mode, JSON.stringify(args)], { env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  const messages = [];
  proc.on('message', msg => messages.push(msg));
  const exit = new Promise((res, rej) => {
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('error', rej);
    proc.on('exit', (code, signal) => res({ code, signal, stdout, stderr, messages }));
  });
  return { proc, exit, messages, kill: () => proc.kill('SIGKILL') };
}

export async function waitMessage(handle, type, ms = 3_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const found = handle.messages.find(message => message?.type === type);
    if (found) return found;
    if (handle.proc.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`child did not report ${type}`);
}

export async function stopChild(handle) {
  if (handle.proc.exitCode === null) handle.kill();
  await handle.exit;
}
