import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, writeFile, copyFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { candidate, scratch, options, limits, token, session, sessionEvent,
  identity, command, consent, directoryEvent, directoryCommitted, id43, digest64, commandId,
  child, waitMessage, stopChild, candidatePath, sqliteModule, scratchRoot, sqlite3 } from './fixtures.mjs';
import { canonicalSessionEvent } from './session-outbox-inspection.mjs';

async function created(databasePath, limitsOverride) {
  const open = await candidate();
  return open(options(databasePath, 'create', limitsOverride));
}
async function opened(databasePath, limitsOverride) {
  const open = await candidate();
  return open(options(databasePath, 'open', limitsOverride));
}
async function rejectsEither(promise) {
  await assert.rejects(promise, error => {
    assert.equal(typeof error?.message, 'string');
    assert.equal(/SQLITE_|CREATE TABLE|INSERT INTO|SELECT .* FROM/i.test(error.message), false);
    return true;
  });
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const bounded = (promise, ms = 4_000) => Promise.race([
  promise, delay(ms).then(() => { throw new Error(`oracle deadline ${ms}ms`); }),
]);
const close = async store => { if (store) await store.close(); };
async function freshOutbox(databasePath, eventId, namespace = 'tenant-a') {
  const observer = child('session-outbox-inspect', { databasePath, eventId, namespace });
  try { return (await waitMessage(observer, 'result')).value; }
  finally { await stopChild(observer); }
}

test('DS-T01 create/open and absent/present mode are non-resetting', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath);
  assert.equal((await stat(databasePath)).mode & 0o077, 0);
  try { await rejectsEither(created(databasePath)); }
  finally { await close(store); }
  const reopened = await opened(databasePath);
  await reopened.close();
  await rejectsEither(opened(`${databasePath}.missing`));
  const fresh = child('candidate-open', { databasePath });
  try { assert.equal((await waitMessage(fresh, 'result')).value, 'opened'); assert.equal((await fresh.exit).code, 0); }
  finally { await stopChild(fresh); }
}));

test('DS-T02 wrong identity limits schema and hostile file refuse without alteration', async () => scratch(async ({ databasePath, dir }) => {
  const store = await created(databasePath); await store.close();
  const before = await readFile(databasePath); const mode = (await stat(databasePath)).mode & 0o777;
  const open = await candidate();
  await rejectsEither(open({ ...options(databasePath, 'open'), namespace: 'foreign' }));
  await rejectsEither(open(options(databasePath, 'open', { maxRowBytes: limits.maxRowBytes - 1 })));
  assert.deepEqual(await readFile(databasePath), before);
  assert.equal((await stat(databasePath)).mode & 0o777, mode);
  const corrupt = `${dir}/corrupt.sqlite`;
  await writeFile(corrupt, before.subarray(0, 40));
  await rejectsEither(opened(corrupt));
  await rejectsEither(opened(dir));
  const incomplete = `${dir}/incomplete.sqlite`;
  await copyFile(databasePath, incomplete);
  const raw = await new Promise((resolve, reject) => {
    const db = new (sqlite3().Database)(incomplete, error => error ? reject(error) : resolve(db));
  });
  try {
    const table = await new Promise((resolve, reject) => raw.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name LIMIT 1",
      (error, row) => error ? reject(error) : resolve(row?.name)));
    assert.ok(table, 'created candidate must have at least one schema table');
    await new Promise((resolve, reject) => raw.run('DROP TABLE "' + table.replaceAll('"', '""') + '"',
      error => error ? reject(error) : resolve()));
  } finally { await new Promise(resolve => raw.close(resolve)); }
  const incompleteBefore = await readFile(incomplete);
  await rejectsEither(opened(incomplete));
  assert.deepEqual(await readFile(incomplete), incompleteBefore);
}));

test('DS-T03 separate OS writer lock precedes candidate callback and read', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath); await store.close();
  async function proveLockBeforeCallback(mode, args, expected) {
    const lock = child('neutral-lock', { databasePath });
    let reader;
    try {
      await waitMessage(lock, 'locked');
      reader = child(mode, { databasePath, ...args });
      await waitMessage(reader, 'reader_ready');
      await waitMessage(reader, 'open_started');
      await waitMessage(reader, 'observation_window_elapsed');
      for (const marker of ['callback_entered', 'first_read_started', 'first_read_completed', 'result']) {
        assert.equal(reader.messages.some(m => m.type === marker), false,
          `${mode} reported ${marker} while another process held BEGIN IMMEDIATE`);
      }
      lock.proc.send('release'); await waitMessage(lock, 'released');
      for (const marker of ['callback_entered', 'first_read_started', 'first_read_completed']) {
        assert.ok(await waitMessage(reader, marker), `${mode} did not report ${marker} after release`);
      }
      assert.equal((await waitMessage(reader, 'result')).value, expected);
    } finally { if (reader) await stopChild(reader); await stopChild(lock); }
  }
  await proveLockBeforeCallback('neutral-lock-probe', {}, 'read_completed');
  await proveLockBeforeCallback('candidate-open',
    { read: 'session', id: id43('session'), observeLock: true }, null);
}));

test('DS-T04 session rows and stable event commit together across process restart', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath);
  assert.equal(await store.sessions.transaction(async tx => {
    assert.equal(await tx.insertSession(session()), true);
    assert.equal(await tx.insertToken(token()), true);
    assert.equal(await tx.putEvent(sessionEvent()), true);
    return 'committed';
  }), 'committed');
  await store.close();
  const check = child('candidate-open', { databasePath, read: 'session', id: id43('session') });
  try { assert.deepEqual((await waitMessage(check, 'result')).value, session()); }
  finally { await stopChild(check); }
  const checkToken = child('candidate-open', { databasePath, read: 'token', id: digest64('token') });
  try { assert.deepEqual((await waitMessage(checkToken, 'result')).value, token()); }
  finally { await stopChild(checkToken); }
  assert.deepEqual(await freshOutbox(databasePath, sessionEvent().eventId), {
    rows: [{ event_id: sessionEvent().eventId, event_json: canonicalSessionEvent(sessionEvent()) }],
    queryOnly: 1, writeCode: null,
  });
  const next = await opened(databasePath);
  try {
    await rejectsEither(next.sessions.transaction(async tx => {
      await tx.insertSession(session('prior-write'));
      assert.equal(await tx.insertSession(session()), false);
      return 'must-not-commit';
    }));
    assert.equal(await next.sessions.transaction(tx => tx.getSession('tenant-a', id43('session', 'prior-write'))), null);
    await rejectsEither(next.sessions.transaction(async tx => {
      await tx.insertToken(token('prior-token'));
      assert.equal(await tx.insertToken(token()), false);
      return 'must-not-commit';
    }));
    assert.equal(await next.sessions.transaction(tx => tx.getToken('tenant-a', digest64('token', 'prior-token'))), null);
    await rejectsEither(next.sessions.transaction(async tx => {
      await tx.insertSession(session('prior-event'));
      await tx.putEvent(sessionEvent('prior-event'));
      assert.equal(await tx.putEvent(sessionEvent()), false);
      return 'must-not-commit';
    }));
    assert.equal(await next.sessions.transaction(tx => tx.getSession('tenant-a', id43('session', 'prior-event'))), null);
    assert.deepEqual(await next.sessions.transaction(tx => tx.getToken('tenant-a', digest64('token'))), token());
  } finally { await next.close(); }
  assert.equal((await freshOutbox(databasePath, sessionEvent('prior-event').eventId)).rows.length, 0);
  assert.equal((await freshOutbox(databasePath, sessionEvent().eventId)).rows.length, 1);
}));

test('DS-T05 concurrent refresh writers cannot create two current branches', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath);
  await store.sessions.transaction(async tx => {
    await tx.insertSession(session()); await tx.insertToken(token()); await tx.putEvent(sessionEvent()); return true;
  });
  await store.close();
  const a = child('candidate-refresh', { databasePath, id: 'refresh-a' });
  const b = child('candidate-refresh', { databasePath, id: 'refresh-b' });
  try {
    await Promise.all([waitMessage(a, 'result'), waitMessage(b, 'result')]);
    assert.equal([a, b].map(x => x.messages.find(m => m.type === 'result')?.value).filter(Boolean).length, 1);
    const fresh = await opened(databasePath);
    try {
      const roots = await fresh.sessions.transaction(tx => tx.listSessions('tenant-a', 'account-1'));
      assert.equal(roots.length, 1);
      assert.equal(roots[0].revokedAt !== null, true);
      const branches = await fresh.sessions.transaction(async tx => [
        await tx.getToken('tenant-a', digest64('token', 'refresh-a')),
        await tx.getToken('tenant-a', digest64('token', 'refresh-b'))]);
      assert.ok(branches.filter(Boolean).length <= 1);
    } finally { await fresh.close(); }
  } finally { await stopChild(a); await stopChild(b); }
}));

test('DS-T06 confirmed rollback preserves callback error identity and caught SQL failure aborts', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath);
  try {
    const marker = Object.freeze({ marker: 'callback-object' });
    await assert.rejects(store.sessions.transaction(async tx => { await tx.insertSession(session()); throw marker; }), e => e === marker);
    assert.equal(await store.sessions.transaction(tx => tx.getSession('tenant-a', id43('session'))), null);
  } finally { await store.close(); }
  const receipt = `${databasePath}.sql-fault-receipt`;
  const faulting = child('candidate-caught-sql-failure', { databasePath }, {
    DS_SQL_FAULT_ARM_FILE: `${databasePath}.arm-sql-fault`, DS_SQL_FAULT_RECEIPT: receipt,
  });
  try {
    assert.equal((await waitMessage(faulting, 'callback_caught_real_driver_error')).value, true);
    const outcome = await waitMessage(faulting, 'transaction_error');
    assert.equal(typeof outcome.value.message, 'string');
    assert.equal(outcome.value.message.includes(databasePath), false);
    assert.equal(/SQLITE_|__ds_missing_fault_table__|INSERT INTO/.test(outcome.value.message), false);
    assert.equal(faulting.messages.some(message => message.type === 'result'), false);
    const actual = JSON.parse(await readFile(receipt, 'utf8'));
    assert.deepEqual(actual, { originalVerb: 'INSERT',
      executedSql: 'INSERT INTO "__ds_missing_fault_table__" DEFAULT VALUES',
      sqliteCode: 'SQLITE_ERROR', realDriverCallback: true, failedInSQLite: true });
  } finally { await stopChild(faulting); }
  const fresh = child('candidate-open', { databasePath, read: 'session', id: id43('session', 'before-real-sql-error') });
  try { assert.equal((await waitMessage(fresh, 'result')).value, null); }
  finally { await stopChild(fresh); }
}));

test('DS-T07 directory identity and link uniqueness and generation CAS survive process races', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath); await store.close();
  const a = child('candidate-write', { databasePath, kind: 'directory', id: 'one' });
  const b = child('candidate-write', { databasePath, kind: 'directory', id: 'one' });
  try {
    await Promise.all([a.exit, b.exit]);
    const fresh = await opened(databasePath);
    try {
      const row = await directoryCommitted(fresh, tx => tx.getIdentity('issuer-a', 'subject-one'));
      assert.deepEqual(row, identity('one'));
      const changed = await directoryCommitted(fresh, tx => tx.updateIdentity(0, identity('one', { status: 'unlinked', generation: 2, unlinkedAt: 2 })));
      assert.equal(changed, false);
      assert.equal(await directoryCommitted(fresh, tx => tx.insertIdentity(identity('different', { linkId: id43('link', 'one') }))), false);
      assert.equal(await directoryCommitted(fresh, tx => tx.putAccountRevision('account-one', null, 1)), true);
      assert.equal(await directoryCommitted(fresh, tx => tx.putAccountRevision('account-one', null, 2)), false);
      assert.equal(await directoryCommitted(fresh, tx => tx.countLinks('account-one')), 1);
    } finally { await fresh.close(); }
  } finally { await stopChild(a); await stopChild(b); }
}));

test('DS-T08 five directory row classes commit and count including acknowledged events', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath);
  try {
    await directoryCommitted(store, async tx => {
      assert.equal(await tx.insertIdentity(identity()), true);
      assert.equal(await tx.putAccountRevision('account-1', null, 1), true);
      assert.equal(await tx.insertCommand(command()), true);
      assert.equal(await tx.insertConsent(consent()), true);
      assert.equal(await tx.insertEvent(directoryEvent()), true);
    });
  } finally { await store.close(); }
  const childArgs = { databasePath, commandId: commandId(), consentId: consent().consentId };
  const first = child('candidate-directory-snapshot', childArgs);
  try {
    assert.deepEqual((await waitMessage(first, 'result')).value, { status: 'committed', value: {
      identity: identity(), revision: 1, command: command(), consent: consent(),
      countRows: 5, countPendingEvents: 1,
    } });
  } finally { await stopChild(first); }
  const fresh = await opened(databasePath);
  try { await directoryCommitted(fresh, tx => tx.acknowledgeEvent(id43('directory-event'))); }
  finally { await fresh.close(); }
  const second = child('candidate-directory-snapshot', childArgs);
  try {
    assert.deepEqual((await waitMessage(second, 'result')).value, { status: 'committed', value: {
      identity: identity(), revision: 1, command: command(), consent: consent(),
      countRows: 5, countPendingEvents: 0,
    } });
  } finally { await stopChild(second); }
}));

test('DS-T09 snapshots detach inputs and outputs; foreign namespace denies', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath);
  try {
    const row = identity();
    await directoryCommitted(store, tx => tx.insertIdentity(row));
    row.accountId = 'mutated';
    const found = await directoryCommitted(store, tx => tx.getIdentity('issuer-a', 'subject-1'));
    found.accountId = 'mutated-again';
    assert.deepEqual(await directoryCommitted(store, tx => tx.getIdentity('issuer-a', 'subject-1')), identity());
    await rejectsEither(store.directory.transaction('foreign', tx => tx.countRows()));
    await rejectsEither(store.sessions.transaction(tx => tx.getSession('foreign', id43('session'))));
  } finally { await store.close(); }
}));

test('DS-T10 committed undefined retains exact present value field', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath);
  try {
    const result = await store.directory.transaction('tenant-a', async tx => { await tx.countRows(); return undefined; });
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
    assert.deepEqual(Reflect.ownKeys(result).sort(), ['status', 'value']);
    assert.equal(result.status, 'committed');
    assert.equal(result.value, undefined);
  } finally { await store.close(); }
}));

test('DS-T11 only acknowledged rollback yields exact confirmed_abort', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath);
  try {
    const result = await store.directory.transaction('tenant-a', async tx => { await tx.insertIdentity(identity()); throw new Error('abort'); });
    assert.deepEqual(result, { status: 'confirmed_abort' });
    assert.equal(await directoryCommitted(store, tx => tx.getIdentity('issuer-a', 'subject-1')), null);
    await store.sessions.transaction(tx => tx.insertSession(session('occupied')));
    await rejectsEither(store.sessions.transaction(async tx => {
      await tx.insertSession(session('must-rollback'));
      assert.equal(await tx.insertSession(session('occupied')), false);
      await tx.putEvent(sessionEvent('must-rollback'));
      return 'false insert cannot commit prior writes';
    }));
    assert.equal(await store.sessions.transaction(tx => tx.getSession('tenant-a', id43('session', 'must-rollback'))), null);
  } finally { await store.close(); }
}));

test('DS-T12 real COMMIT with withheld sqlite3 ACK leaves committed row and fresh-open fence', async () => scratch(async ({ databasePath, dir }) => {
  const store = await created(databasePath); await store.close();
  const receipt = `${dir}/commit-intercept.json`;
  const writer = child('candidate-write', { databasePath, kind: 'directory', id: 'ack-loss', armAckAfterOpen: true,
    verifyPoisonAfterUnknown: true },
    { DS_ACK_RECEIPT: receipt, DS_ACK_ARM_FILE: `${dir}/arm-commit`, DS_ACK_SQL: 'COMMIT' });
  try {
    for (let i = 0; i < 200; i++) { try { await stat(receipt); break; } catch { await delay(10); } }
    const observed = JSON.parse(await readFile(receipt, 'utf8'));
    assert.deepEqual({ sql: observed.sql, actualCallbackReached: observed.actualCallbackReached,
      realSqlError: observed.realSqlError, withheld: observed.withheld },
    { sql: 'COMMIT', actualCallbackReached: true, realSqlError: null, withheld: true });
    const unknown = await waitMessage(writer, 'result', 5_000);
    assert.deepEqual(unknown.value, { status: 'unknown' });
    assert.ok(await waitMessage(writer, 'after_unknown_error'));
    writer.kill(); await writer.exit;
    const fresh = child('candidate-open', { databasePath, read: 'identity', id: 'subject-ack-loss' });
    try { await waitMessage(fresh, 'error'); assert.equal(fresh.messages.some(m => m.type === 'result'), false); }
    finally { await stopChild(fresh); }
    const open = await candidate();
    let tuple;
    await rejectsEither(open({ ...options(databasePath, 'open'), recovery: {
      reconcile: async observedTuple => { tuple = observedTuple; return { status: 'hold' }; },
    } }));
    assert.equal(tuple.phase, 'committed_unacknowledged');
    assert.equal(tuple.namespace, 'tenant-a');
    assert.equal(tuple.eventIds.includes(id43('directory-event', 'ack-loss')), true);
    assert.match(tuple.writeSetDigest, /^[a-f0-9]{64}$/);
    // A test-supplied current tuple exercises adapter reconciliation mechanics.
    // Its evidenceId is not independently qualified host authority (DS-I01).
    const recovered = await open({ ...options(databasePath, 'open'), recovery: {
      reconcile: async () => ({ ...tuple, status: 'resolved', outcome: 'committed', evidenceId: 'test-only-reconciled' }),
    } });
    try { assert.deepEqual(await directoryCommitted(recovered, tx => tx.getIdentity('issuer-a', 'subject-ack-loss')), identity('ack-loss')); }
    finally { await recovered.close(); }
  } finally { await stopChild(writer); }
  const sessionDb = `${databasePath}.session`;
  const sessionStore = await created(sessionDb); await sessionStore.close();
  const sessionReceipt = `${dir}/session-commit-intercept.json`;
  const sessionWriter = child('candidate-session-ack-loss', { databasePath: sessionDb, id: 'ack-loss' }, {
    DS_ACK_RECEIPT: sessionReceipt, DS_ACK_ARM_FILE: `${dir}/arm-session-commit`, DS_ACK_SQL: 'COMMIT',
  });
  try {
    const safe = await waitMessage(sessionWriter, 'transaction_error', 5_000);
    assert.equal(typeof safe.value.message, 'string');
    assert.equal(safe.value.message.includes(sessionDb), false);
    assert.equal(/SQLITE_|INSERT INTO|COMMIT/.test(safe.value.message), false);
    assert.equal(sessionWriter.messages.some(m => m.type === 'result'), false);
    assert.ok(await waitMessage(sessionWriter, 'after_unknown_error'));
    const sessionIntercept = JSON.parse(await readFile(sessionReceipt, 'utf8'));
    assert.ok(['run', 'exec'].includes(sessionIntercept.method));
    assert.deepEqual({ ...sessionIntercept, method: 'qualified-sqlite3-call' },
      { method: 'qualified-sqlite3-call', sql: 'COMMIT', actualCallbackReached: true,
        realSqlError: null, withheld: true });
    sessionWriter.kill(); await sessionWriter.exit;
    await rejectsEither(opened(sessionDb));
    const open = await candidate(); let tuple;
    await rejectsEither(open({ ...options(sessionDb, 'open'), recovery: {
      reconcile: async observed => { tuple = observed; return { status: 'hold' }; },
    } }));
    assert.equal(tuple.phase, 'committed_unacknowledged');
    assert.equal(tuple.eventIds.includes(digest64('session-event', 'ack-loss')), true);
    const recovered = await open({ ...options(sessionDb, 'open'), recovery: {
      reconcile: async () => ({ ...tuple, status: 'resolved', outcome: 'committed', evidenceId: 'test-session-proof' }),
    } });
    try {
      assert.deepEqual(await recovered.sessions.transaction(tx => tx.getSession('tenant-a', id43('session', 'ack-loss'))), session('ack-loss'));
      assert.deepEqual(await recovered.sessions.transaction(tx => tx.getToken('tenant-a', digest64('token', 'ack-loss'))), token('ack-loss'));
    } finally { await recovered.close(); }
  } finally { await stopChild(sessionWriter); }
}));

test('DS-T13 lost rollback ACK and mismatched recovery cannot clear fresh-process fence', async () => scratch(async ({ databasePath, dir }) => {
  const store = await created(databasePath); await store.close();
  const receipt = `${dir}/rollback-intercept.json`;
  const aborting = child('candidate-abort', { databasePath, id: 'rollback-loss', armAckAfterOpen: true },
    { DS_ACK_RECEIPT: receipt, DS_ACK_ARM_FILE: `${dir}/arm-rollback`, DS_ACK_SQL: 'ROLLBACK' });
  try {
    for (let i = 0; i < 200; i++) { try { await stat(receipt); break; } catch { await delay(10); } }
    const observed = JSON.parse(await readFile(receipt, 'utf8'));
    assert.equal(observed.sql, 'ROLLBACK'); assert.equal(observed.withheld, true);
    assert.deepEqual((await waitMessage(aborting, 'result', 5_000)).value, { status: 'unknown' });
    aborting.kill(); await aborting.exit;
    const open = await candidate();
    const seen = [];
    await rejectsEither(open({ ...options(databasePath, 'open'), recovery: {
      reconcile: async tuple => { seen.push(tuple); return { status: 'resolved', ...tuple, generation: tuple.generation + 1,
        outcome: 'confirmed_abort', evidenceId: 'mismatched-generation' }; },
    } }));
    assert.equal(seen.length, 1);
    await rejectsEither(opened(databasePath));
  } finally { await stopChild(aborting); }
}));

test('DS-T14 kill before COMMIT retains pending fence; confirmed COMMIT survives kill', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath); await store.close();
  const holding = child('candidate-hold', { databasePath, id: 'killed' });
  try { await waitMessage(holding, 'written_in_callback'); holding.kill(); await holding.exit;
    await rejectsEither(opened(databasePath));
  } finally { await stopChild(holding); }
  // Distinct database: a successful acknowledged commit and fence clear survives
  // killing the process that owned the connection.
  const confirmed = `${databasePath}.confirmed`;
  const first = child('candidate-write', { databasePath: confirmed, create: true, kind: 'session', id: 'survives' });
  try { assert.equal((await waitMessage(first, 'result')).value, true); first.kill(); await first.exit;
    const fresh = await opened(confirmed);
    try { assert.deepEqual(await fresh.sessions.transaction(tx => tx.getSession('tenant-a', id43('session', 'survives'))), session('survives')); }
    finally { await fresh.close(); }
  } finally { await stopChild(first); }
}));

test('DS-T15 exact current host reconciliation receipt alone can clear a matching fence', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath); await store.close();
  const holding = child('candidate-hold', { databasePath, id: 'pending' });
  try { await waitMessage(holding, 'written_in_callback'); holding.kill(); await holding.exit; }
  finally { await stopChild(holding); }
  const open = await candidate();
  let observed;
  await rejectsEither(open({ ...options(databasePath, 'open'), recovery: { reconcile: async tuple => { observed = tuple; return { status: 'hold' }; } } }));
  assert.equal(typeof observed.databaseId, 'string'); assert.equal(observed.phase, 'pending');
  const mismatched = { status: 'resolved', ...observed, transactionId: `${observed.transactionId}x`,
    outcome: 'confirmed_abort', evidenceId: 'host-proof-a' };
  await rejectsEither(open({ ...options(databasePath, 'open'), recovery: { reconcile: async () => mismatched } }));
  await rejectsEither(opened(databasePath));
  const recovered = await open({ ...options(databasePath, 'open'), recovery: {
    reconcile: async () => ({ ...observed, status: 'resolved', outcome: 'confirmed_abort', evidenceId: 'test-only-abort-proof' }),
  } });
  try { assert.equal(await directoryCommitted(recovered, tx => tx.getIdentity('issuer-a', 'subject-pending')), null); }
  finally { await recovered.close(); }
  // This injected port result tests adapter CAS mechanics, not independent DS-I01 authority.
}));

test('DS-T16 queue overflow and expiry cannot admit late SQL', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath, { maxQueueDepth: 1, transactionTimeoutMs: 100 });
  let release; const barrier = new Promise(resolve => { release = resolve; });
  try {
    const busy = store.directory.transaction('tenant-a', async tx => {
      await tx.countRows(); await barrier;
      await tx.insertIdentity(identity()); // Must be fenced after deadline.
      return 'done';
    });
    const busySettled = busy.then(value => ({ status: 'fulfilled', value }), reason => ({ status: 'rejected', reason }));
    await delay(20);
    const queued = store.directory.transaction('tenant-a', tx => tx.countRows());
    const overflow = store.directory.transaction('tenant-a', tx => tx.countRows());
    const result = await bounded(Promise.allSettled([queued, overflow]));
    assert.ok(result.some(x => x.status === 'rejected' || x.value?.status !== 'committed'));
    await delay(150); release();
    const expired = await bounded(busySettled);
    assert.ok(expired.status === 'rejected' || expired.value?.status !== 'committed');
    if (expired.value?.status === 'confirmed_abort') {
      assert.equal(await directoryCommitted(store, tx => tx.getIdentity('issuer-a', 'subject-1')), null);
    } else {
      await rejectsEither(opened(databasePath));
    }
  } finally { release(); await store.close(); }
}));

test('DS-T17 independent logical row byte aggregate and pending caps fail without pruning', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath, { maxLogicalRowsPerNamespace: 20, maxPendingOutboxPerNamespace: 1,
    maxRowBytes: 1024, maxLogicalBytesPerNamespace: 2500 });
  try {
    await directoryCommitted(store, async tx => {
      await tx.insertIdentity(identity()); await tx.putAccountRevision('account-1', null, 1);
      await tx.insertCommand(command()); await tx.insertConsent(consent()); await tx.insertEvent(directoryEvent());
    });
    const cap = await store.directory.transaction('tenant-a', async tx => {
      await tx.insertIdentity(identity('2')); await tx.putAccountRevision('account-2', null, 1);
      await tx.insertCommand(command('2')); await tx.insertConsent(consent('2'));
      return tx.insertEvent(directoryEvent('2'));
    });
    assert.notEqual(cap.status, 'committed');
    assert.equal(await directoryCommitted(store, tx => tx.countPendingEvents()), 1);
    const large = await store.directory.transaction('tenant-a', tx => tx.insertIdentity(identity('large', { subject: 'x'.repeat(2000) })));
    assert.notEqual(large.status, 'committed');
    assert.equal(await directoryCommitted(store, tx => tx.countRows()), 5);
  } finally { await store.close(); }
  const rowCap = await created(`${databasePath}.rows`, { maxLogicalRowsPerNamespace: 1 });
  try {
    assert.equal(await directoryCommitted(rowCap, tx => tx.insertIdentity(identity())), true);
    assert.notEqual((await rowCap.directory.transaction('tenant-a', tx => tx.insertIdentity(identity('2')))).status, 'committed');
    assert.equal(await directoryCommitted(rowCap, tx => tx.countRows()), 1);
  } finally { await rowCap.close(); }
  const firstBytes = Buffer.byteLength(JSON.stringify(identity()), 'utf8');
  const rowBytes = await created(`${databasePath}.bytes`, { maxRowBytes: firstBytes - 1 });
  try {
    assert.notEqual((await rowBytes.directory.transaction('tenant-a', tx => tx.insertIdentity(identity()))).status, 'committed');
    assert.equal(await directoryCommitted(rowBytes, tx => tx.countRows()), 0);
  } finally { await rowBytes.close(); }
  const aggregate = await created(`${databasePath}.aggregate`, { maxLogicalBytesPerNamespace: firstBytes + 10 });
  try {
    assert.equal(await directoryCommitted(aggregate, tx => tx.insertIdentity(identity())), true);
    assert.notEqual((await aggregate.directory.transaction('tenant-a', tx => tx.insertIdentity(identity('2')))).status, 'committed');
    assert.equal(await directoryCommitted(aggregate, tx => tx.countRows()), 1);
  } finally { await aggregate.close(); }
}));

test('DS-T18 stable event IDs survive restart and only durable directory ACK reduces pending', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath);
  try {
    await store.sessions.transaction(async tx => { await tx.insertSession(session()); await tx.putEvent(sessionEvent()); });
    await directoryCommitted(store, async tx => {
      await tx.insertIdentity(identity()); await tx.putAccountRevision('account-1', null, 1);
      await tx.insertCommand(command()); await tx.insertConsent(consent()); await tx.insertEvent(directoryEvent());
    });
  } finally { await store.close(); }
  assert.deepEqual(await freshOutbox(databasePath, sessionEvent().eventId), {
    rows: [{ event_id: sessionEvent().eventId, event_json: canonicalSessionEvent(sessionEvent()) }],
    queryOnly: 1, writeCode: null,
  });
  const fresh = await opened(databasePath);
  try {
    await rejectsEither(fresh.sessions.transaction(tx => tx.putEvent(sessionEvent())));
    assert.equal(await directoryCommitted(fresh, tx => tx.countPendingEvents()), 1);
    assert.deepEqual(await fresh.directory.transaction('tenant-a', tx => tx.insertEvent(directoryEvent())), { status: 'confirmed_abort' });
    assert.equal(await directoryCommitted(fresh, tx => tx.countPendingEvents()), 1);
    await directoryCommitted(fresh, tx => tx.acknowledgeEvent(id43('directory-event')));
  } finally { await fresh.close(); }
  const later = await opened(databasePath);
  try { assert.equal(await directoryCommitted(later, tx => tx.countPendingEvents()), 0); }
  finally { await later.close(); }
  assert.equal((await freshOutbox(databasePath, sessionEvent().eventId)).rows.length, 1);
}));

test('DS-T19 same namespace distinct accounts serialize; another namespace needs another database', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath);
  try {
    await Promise.all(['a', 'b'].map(id => directoryCommitted(store, tx => tx.insertIdentity(identity(id)))));
    assert.equal(await directoryCommitted(store, tx => tx.countLinks('account-a')), 1);
    assert.equal(await directoryCommitted(store, tx => tx.countLinks('account-b')), 1);
    await rejectsEither(store.directory.transaction('foreign', tx => tx.countRows()));
  } finally { await store.close(); }
  const open = await candidate();
  const second = await open({ ...options(`${databasePath}.other`, 'create'), namespace: 'tenant-b' });
  await second.close();
  assert.equal(await stat(`${databasePath}.other`).then(s => s.isFile()), true);
}));

test('DS-T20 close during callback terminates boundedly and never permits late commit', async () => scratch(async ({ databasePath }) => {
  const store = await created(databasePath);
  let release; const barrier = new Promise(resolve => { release = resolve; });
  const running = store.directory.transaction('tenant-a', async tx => {
    await tx.insertIdentity(identity()); await barrier; return 'late';
  });
  const runningSettled = running.then(value => ({ status: 'fulfilled', value }), reason => ({ status: 'rejected', reason }));
  try {
    await delay(20);
    const closing = store.close();
    release();
    const [outcome] = await bounded(Promise.all([runningSettled, closing]));
    assert.ok(outcome.status === 'rejected' || ['committed', 'unknown', 'confirmed_abort'].includes(outcome.value?.status));
    await store.close();
    await rejectsEither(store.directory.transaction('tenant-a', tx => tx.countRows()));
    if (outcome.status === 'fulfilled' && outcome.value.status !== 'unknown') {
      const fresh = await opened(databasePath);
      try { assert.deepEqual(await directoryCommitted(fresh, tx => tx.getIdentity('issuer-a', 'subject-1')),
        outcome.value.status === 'committed' ? identity() : null); }
      finally { await fresh.close(); }
    } else {
      await rejectsEither(opened(databasePath));
    }
  } finally { release(); await store.close(); }
}));

test('DS-T21 actual Node 20 imports locked sqlite3 and performs real-file candidate smoke', async () => scratch(async ({ databasePath }) => {
  const binary = process.env.YALC_AUTH_DURABLE_NODE20;
  assert.ok(binary?.startsWith('/'), 'qualification unresolved: explicit absolute Node 20 binary required');
  const version = await new Promise((resolve, reject) => {
    const proc = spawn(binary, ['-p', 'process.versions.node'], { env: { PATH: '/usr/bin:/bin' } });
    let out = ''; proc.stdout.on('data', d => out += d);
    proc.on('error', reject); proc.on('exit', code => code === 0 ? resolve(out.trim()) : reject(new Error('Node 20 version failed')));
  });
  assert.match(version, /^20\./);
  const script = new URL('node20-smoke.mjs', import.meta.url).pathname;
  const result = await new Promise((resolve, reject) => {
    const proc = spawn(binary, [script, databasePath], { env: {
      PATH: '/usr/bin:/bin', YALC_AUTH_DURABLE_CANDIDATE: candidatePath,
      YALC_SQLITE3_MODULE: sqliteModule, YALC_AUTH_DURABLE_SCRATCH: scratchRoot,
    } });
    let out = '', err = ''; proc.stdout.on('data', d => out += d); proc.stderr.on('data', d => err += d);
    proc.on('error', reject); proc.on('exit', code => resolve({ code, out, err }));
  });
  if (!process.env.YALC_AUTH_DURABLE_CANDIDATE && result.err.includes('DS_UNIMPLEMENTED')) {
    throw new Error('DS_UNIMPLEMENTED: Node 20 loaded sqlite3 and the durable candidate is absent');
  }
  assert.equal(result.code, 0, result.err);
  assert.match(result.out, /NODE20_SQLITE_CANDIDATE_OK/);
}));
