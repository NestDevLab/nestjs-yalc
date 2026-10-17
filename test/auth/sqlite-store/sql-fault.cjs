'use strict';
// Private test preload: substitute one data-write SQL with SQL that really fails
// inside the installed sqlite3 driver. This is never imported by an adapter.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sqliteModule = process.env.YALC_SQLITE3_MODULE;
const armFile = process.env.DS_SQL_FAULT_ARM_FILE;
const receiptFile = process.env.DS_SQL_FAULT_RECEIPT;
for (const value of [sqliteModule, armFile, receiptFile]) assert.ok(value && path.isAbsolute(value));
const sqlite = require(sqliteModule);
const originalExec = sqlite.Database.prototype.exec;
const originalPrepare = sqlite.Database.prototype.prepare;
const owner = new WeakMap();
sqlite.Database.prototype.prepare = function (...args) {
  const statement = originalPrepare.apply(this, args);
  owner.set(statement, this);
  return statement;
};
let fired = false;
const faultySql = 'INSERT INTO "__ds_missing_fault_table__" DEFAULT VALUES';
function shouldFault(sql, args) {
  return !fired && fs.existsSync(armFile) && /^\s*(INSERT|UPDATE|REPLACE|DELETE)\b/i.test(sql) &&
    args.some(value => typeof value === 'function');
}
function inject(db, originalSql, args, returnValue) {
  fired = true;
  fs.unlinkSync(armFile);
  const callback = args.findLast(value => typeof value === 'function');
  originalExec.call(db, faultySql, function (realError) {
    fs.writeFileSync(receiptFile, JSON.stringify({
      originalVerb: /^\s*(\w+)/.exec(originalSql)?.[1].toUpperCase(),
      executedSql: faultySql, sqliteCode: realError?.code ?? null,
      realDriverCallback: true,
      failedInSQLite: /no such table/i.test(realError?.message ?? ''),
    }));
    callback.call(this, realError);
  });
  return returnValue;
}
for (const method of ['run', 'exec', 'get', 'all']) {
  const original = sqlite.Database.prototype[method];
  sqlite.Database.prototype[method] = function (sql, ...args) {
    if (shouldFault(sql, args)) return inject(this, sql, args, this);
    return original.call(this, sql, ...args);
  };
}
for (const method of ['run', 'get', 'all']) {
  const original = sqlite.Statement.prototype[method];
  sqlite.Statement.prototype[method] = function (...args) {
    if (owner.has(this) && shouldFault(this.sql, args)) return inject(owner.get(this), this.sql, args, this);
    return original.apply(this, args);
  };
}
