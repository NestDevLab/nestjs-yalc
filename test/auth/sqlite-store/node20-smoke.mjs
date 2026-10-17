import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { isAbsolute } from 'node:path';
import { unlink } from 'node:fs/promises';

const [databasePath] = process.argv.slice(2);
assert.match(process.versions.node, /^20\./);
assert.ok(isAbsolute(databasePath));
assert.ok(isAbsolute(process.env.YALC_SQLITE3_MODULE ?? ''));
assert.ok(isAbsolute(process.env.YALC_AUTH_DURABLE_CANDIDATE ?? ''));
const sqlite = createRequire(import.meta.url)(process.env.YALC_SQLITE3_MODULE);
assert.equal(typeof sqlite.Database, 'function');
const neutralPath = `${databasePath}.node20-neutral`;
const db = await new Promise((resolve, reject) => {
  const connection = new sqlite.Database(neutralPath, error => error ? reject(error) : resolve(connection));
});
const run = statement => new Promise((resolve, reject) => db.run(statement, error => error ? reject(error) : resolve()));
const get = statement => new Promise((resolve, reject) => db.get(statement, (error, row) => error ? reject(error) : resolve(row)));
await run('CREATE TABLE node20_probe (value INTEGER NOT NULL)');
await run('INSERT INTO node20_probe (value) VALUES (20)');
assert.deepEqual(await get('SELECT value FROM node20_probe'), { value: 20 });
await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
await unlink(neutralPath);
const { openAuthSqliteStore } = await import(pathToFileURL(process.env.YALC_AUTH_DURABLE_CANDIDATE).href);
const limits = { maxLogicalRowsPerNamespace: 10, maxRowBytes: 4096,
  maxLogicalBytesPerNamespace: 40960, maxPendingOutboxPerNamespace: 5,
  maxQueueDepth: 3, busyTimeoutMs: 1000, transactionTimeoutMs: 2000 };
const store = await openAuthSqliteStore({ mode: 'create', databasePath, namespace: 'tenant-a', limits,
  recovery: { reconcile: async () => ({ status: 'hold' }) } });
try {
  const outcome = await store.directory.transaction('tenant-a', tx => tx.countRows());
  assert.deepEqual(outcome, { status: 'committed', value: 0 });
} finally { await store.close(); }
process.stdout.write('NODE20_SQLITE_CANDIDATE_OK\n');
