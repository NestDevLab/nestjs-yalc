'use strict';
// Private test process preload. Never imported by a candidate or published adapter.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const modulePath = process.env.YALC_SQLITE3_MODULE;
const receiptPath = process.env.DS_ACK_RECEIPT;
assert.ok(modulePath && path.isAbsolute(modulePath));
assert.ok(receiptPath && path.isAbsolute(receiptPath));
const sqlite = require(modulePath);
for (const method of ['run', 'exec']) {
  const original = sqlite.Database.prototype[method];
  assert.equal(typeof original, 'function');
  sqlite.Database.prototype[method] = function (sql, ...args) {
    const callbackAt = args.findLastIndex(value => typeof value === 'function');
    const armFile = process.env.DS_ACK_ARM_FILE;
    const armed = process.env.DS_ACK_ARMED === '1' ||
      (armFile && path.isAbsolute(armFile) && fs.existsSync(armFile));
    const target = process.env.DS_ACK_SQL ?? 'COMMIT';
    const normalized = sql.trim().toUpperCase().replace(/;$/, '').replace(/\s+TRANSACTION$/, '');
    if (!armed || callbackAt < 0 || normalized !== target) {
      return original.call(this, sql, ...args);
    }
    process.env.DS_ACK_ARMED = '0';
    if (armFile && fs.existsSync(armFile)) fs.unlinkSync(armFile);
    const callback = args[callbackAt];
    args[callbackAt] = function (...values) {
      fs.writeFileSync(receiptPath, JSON.stringify({ method, sql: normalized,
        actualCallbackReached: true, realSqlError: values[0]?.message ?? null,
        withheld: values[0] == null }));
      if (values[0] != null) return callback.apply(this, values);
      // Suppress only the success acknowledgement after the real sqlite3 callback.
    };
    return original.call(this, sql, ...args);
  };
}
