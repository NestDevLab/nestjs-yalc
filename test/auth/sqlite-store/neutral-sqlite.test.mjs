import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { scratch, sqlite3, sqliteModule, child, waitMessage, stopChild,
  id43, digest64, commandId, identity, command, token, session, sessionEvent, directoryEvent } from './fixtures.mjs';
import { SESSION_OUTBOX_SCHEMA, canonicalSessionEvent } from './session-outbox-inspection.mjs';

const openRaw = path => new Promise((resolve, reject) => {
  const db = new (sqlite3().Database)(path, error => error ? reject(error) : resolve(db));
});
const sql = (db, statement, params = []) => new Promise((resolve, reject) =>
  db.run(statement, params, error => error ? reject(error) : resolve()));
const get = (db, statement, params = []) => new Promise((resolve, reject) =>
  db.get(statement, params, (error, row) => error ? reject(error) : resolve(row)));
const close = db => new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('DS-N01 explicit installed sqlite3 5.1.7 loads and file persists after fresh connection', async () => scratch(async ({ databasePath }) => {
  const require = createRequire(import.meta.url);
  const pkg = require(sqliteModule.replace(/\/lib\/sqlite3\.js$/, '/package.json'));
  assert.equal(pkg.version, '5.1.7');
  const db = await openRaw(databasePath);
  await sql(db, 'CREATE TABLE neutral (id TEXT PRIMARY KEY, value TEXT NOT NULL)');
  await sql(db, 'INSERT INTO neutral (id,value) VALUES (?,?)', ['a', 'value']);
  await close(db);
  assert.equal((await stat(databasePath)).isFile(), true);
  const fresh = await openRaw(databasePath);
  try { assert.deepEqual(await get(fresh, 'SELECT value FROM neutral WHERE id=?', ['a']), { value: 'value' }); }
  finally { await close(fresh); }
}));

test('DS-N02 two OS processes observe BEGIN IMMEDIATE before protected read', async () => scratch(async ({ databasePath }) => {
  const db = await openRaw(databasePath);
  await sql(db, 'CREATE TABLE neutral (id TEXT PRIMARY KEY, value TEXT NOT NULL)'); await close(db);
  const holder = child('neutral-lock', { databasePath });
  let second;
  try {
    await waitMessage(holder, 'locked');
    second = child('neutral-lock', { databasePath });
    await delay(100);
    assert.equal(second.messages.some(x => x.type === 'locked'), false);
    holder.proc.send('release'); await waitMessage(holder, 'released');
    assert.ok(await waitMessage(second, 'locked'));
    second.proc.send('release'); await waitMessage(second, 'released');
  } finally { if (second) await stopChild(second); await stopChild(holder); }
}));

test('DS-N03 OS kill before COMMIT rolls back while confirmed COMMIT survives kill', async () => scratch(async ({ databasePath }) => {
  const db = await openRaw(databasePath);
  await sql(db, 'CREATE TABLE neutral (id TEXT PRIMARY KEY, value TEXT NOT NULL)'); await close(db);
  const killed = child('neutral-write-kill', { databasePath, id: 'before', value: 'lost' });
  try { await waitMessage(killed, 'written_uncommitted'); killed.kill(); await killed.exit; }
  finally { await stopChild(killed); }
  const committed = child('neutral-write-kill', { databasePath, id: 'after', value: 'retained' });
  try { await waitMessage(committed, 'written_uncommitted'); committed.proc.send('commit');
    await waitMessage(committed, 'committed'); committed.kill(); await committed.exit;
  } finally { await stopChild(committed); }
  const observer = await openRaw(databasePath);
  try {
    assert.equal(await get(observer, 'SELECT value FROM neutral WHERE id=?', ['before']), undefined);
    assert.deepEqual(await get(observer, 'SELECT value FROM neutral WHERE id=?', ['after']), { value: 'retained' });
  } finally { await close(observer); }
}));

test('DS-N04 private preload withholds only actual successful COMMIT callback', async () => scratch(async ({ databasePath, dir }) => {
  const db = await openRaw(databasePath);
  await sql(db, 'CREATE TABLE neutral (id TEXT PRIMARY KEY, value TEXT NOT NULL)'); await close(db);
  const receipt = `${dir}/ack.json`;
  const writer = child('neutral-write-kill', { databasePath, id: 'after-ack-loss', value: 'committed', armAckBeforeCommit: true },
    { DS_ACK_RECEIPT: receipt, DS_ACK_SQL: 'COMMIT' });
  try {
    await waitMessage(writer, 'written_uncommitted'); writer.proc.send('commit');
    for (let i = 0; i < 200; i++) { try { await stat(receipt); break; } catch { await delay(10); } }
    assert.deepEqual(JSON.parse(await readFile(receipt, 'utf8')),
      { method: 'run', sql: 'COMMIT', actualCallbackReached: true, realSqlError: null, withheld: true });
    assert.equal(writer.messages.some(x => x.type === 'committed'), false);
    writer.kill(); await writer.exit;
  } finally { await stopChild(writer); }
  const observer = await openRaw(databasePath);
  try { assert.deepEqual(await get(observer, 'SELECT value FROM neutral WHERE id=?', ['after-ack-loss']), { value: 'committed' }); }
  finally { await close(observer); }
}));

test('DS-N05 positive port rows use the published complete identity and receipt shapes', () => {
  assert.match(id43('link'), /^[A-Za-z0-9_-]{43}$/);
  assert.match(digest64('token'), /^[a-f0-9]{64}$/);
  assert.match(commandId(), /^1\.[A-Za-z0-9_-]{43}$/);
  assert.equal(identity().linkId.length, 43);
  assert.deepEqual(command().result, { status: 'linked', accountId: 'account-1',
    linkId: id43('link'), revision: 1, replay: false });
  assert.equal(command().commandId, directoryEvent().commandId);
  assert.equal(command().eventId, directoryEvent().eventId);
  assert.equal(session().sessionId, token().sessionId);
  assert.match(token().tokenHash, /^[a-f0-9]{64}$/);
  assert.match(sessionEvent().eventId, /^[a-f0-9]{64}$/);
});

test('DS-N06 private SQL fault is a real sqlite3 failure after a prior valid write', async () => scratch(async ({ databasePath, dir }) => {
  const db = await openRaw(databasePath);
  await sql(db, 'CREATE TABLE neutral (id TEXT PRIMARY KEY, value TEXT NOT NULL)'); await close(db);
  const receipt = `${dir}/sql-fault.json`;
  const fault = child('neutral-sql-fault', { databasePath }, {
    DS_SQL_FAULT_ARM_FILE: `${dir}/arm-sql-fault`, DS_SQL_FAULT_RECEIPT: receipt,
  });
  try { assert.equal((await waitMessage(fault, 'result')).value, 'SQLITE_ERROR'); }
  finally { await stopChild(fault); }
  assert.deepEqual(JSON.parse(await readFile(receipt, 'utf8')), {
    originalVerb: 'INSERT', executedSql: 'INSERT INTO "__ds_missing_fault_table__" DEFAULT VALUES',
    sqliteCode: 'SQLITE_ERROR', realDriverCallback: true, failedInSQLite: true,
  });
  const fresh = await openRaw(databasePath);
  try { assert.equal(await get(fresh, 'SELECT value FROM neutral WHERE id=?', ['prior']), undefined); }
  finally { await close(fresh); }
}));

test('DS-N07 proposed outbox query is exact, read-only, restart-safe and rollback-aware', async () => scratch(async ({ databasePath }) => {
  const db = await openRaw(databasePath);
  const event = sessionEvent();
  await sql(db, SESSION_OUTBOX_SCHEMA);
  await sql(db, 'BEGIN IMMEDIATE');
  await sql(db, 'INSERT INTO auth_session_outbox (namespace,event_id,event_json) VALUES (?,?,?)',
    ['tenant-a', event.eventId, canonicalSessionEvent(event)]);
  await sql(db, 'COMMIT');
  await assert.rejects(sql(db, 'INSERT INTO auth_session_outbox (namespace,event_id,event_json) VALUES (?,?,?)',
    ['tenant-a', event.eventId, canonicalSessionEvent(event)]), error => error.code === 'SQLITE_CONSTRAINT');
  await sql(db, 'BEGIN IMMEDIATE');
  await sql(db, 'INSERT INTO auth_session_outbox (namespace,event_id,event_json) VALUES (?,?,?)',
    ['tenant-a', sessionEvent('rolled-back').eventId, canonicalSessionEvent(sessionEvent('rolled-back'))]);
  await sql(db, 'ROLLBACK');
  await close(db);
  const inspect = async (namespace, eventId, probeWrite = false) => {
    const observer = child('session-outbox-inspect', { databasePath, namespace, eventId, probeWrite });
    try { return (await waitMessage(observer, 'result')).value; }
    finally { await stopChild(observer); }
  };
  assert.deepEqual(await inspect('tenant-a', event.eventId, true), {
    rows: [{ event_id: event.eventId, event_json: canonicalSessionEvent(event) }],
    queryOnly: 1, writeCode: 'SQLITE_READONLY',
  });
  assert.deepEqual((await inspect('foreign', event.eventId)).rows, []);
  assert.deepEqual((await inspect('tenant-a', sessionEvent('rolled-back').eventId)).rows, []);
  assert.deepEqual((await inspect('tenant-a', 'forbidden-test-write')).rows, []);
  assert.equal((await inspect('tenant-a', event.eventId)).rows.length, 1);
}));
