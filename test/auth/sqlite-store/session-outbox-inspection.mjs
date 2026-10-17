// Draft-v2 read-only inspection helper for the proposed physical session outbox.
// The contract supplement is NOT ACCEPTED; this is test code, never an adapter API.
import assert from 'node:assert/strict';
import { sqlite3 } from './fixtures.mjs';

export const SESSION_OUTBOX_SCHEMA = `CREATE TABLE auth_session_outbox (
  namespace TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_json TEXT NOT NULL,
  PRIMARY KEY (namespace, event_id)
) WITHOUT ROWID`;

export async function inspectSessionOutbox(databasePath, namespace, eventId, probeWrite = false) {
  const driver = sqlite3();
  const db = await new Promise((resolve, reject) => {
    const connection = new driver.Database(databasePath, driver.OPEN_READONLY,
      error => error ? reject(error) : resolve(connection));
  });
  const run = (statement, params = []) => new Promise((resolve, reject) =>
    db.run(statement, params, error => error ? reject(error) : resolve()));
  const get = statement => new Promise((resolve, reject) =>
    db.get(statement, (error, row) => error ? reject(error) : resolve(row)));
  const all = (statement, params) => new Promise((resolve, reject) =>
    db.all(statement, params, (error, rows) => error ? reject(error) : resolve(rows)));
  try {
    await run('PRAGMA query_only=ON');
    const setting = await get('PRAGMA query_only');
    assert.deepEqual(setting, { query_only: 1 });
    const rows = await all(
      'SELECT event_id, event_json FROM auth_session_outbox WHERE namespace = ? AND event_id = ?',
      [namespace, eventId]);
    let writeCode = null;
    if (probeWrite) {
      try { await run('INSERT INTO auth_session_outbox (namespace,event_id,event_json) VALUES (?,?,?)',
        [namespace, 'forbidden-test-write', '{}']); }
      catch (error) { writeCode = error.code; }
    }
    return { rows, queryOnly: setting.query_only, writeCode };
  } finally {
    await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
  }
}

export function canonicalSessionEvent(event) {
  assert.deepEqual(Object.keys(event).sort(), ['at', 'eventId', 'kind', 'namespace', 'reason', 'revision', 'sessionId']);
  return JSON.stringify(Object.fromEntries(Object.entries(event).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
}
