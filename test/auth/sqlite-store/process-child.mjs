import { candidate, options, sqlite3, token, session, sessionEvent, identity, command, consent,
  directoryEvent, id43, digest64 } from './fixtures.mjs';
import { writeFileSync } from 'node:fs';
import { inspectSessionOutbox } from './session-outbox-inspection.mjs';

const [mode, json] = process.argv.slice(2);
const args = JSON.parse(json ?? '{}');
const send = (type, value) => process.send?.({ type, value });
const armAck = () => {
  if (process.env.DS_ACK_ARM_FILE) writeFileSync(process.env.DS_ACK_ARM_FILE, 'armed');
  process.env.DS_ACK_ARMED = '1';
};

function rawDatabase(path) {
  const driver = sqlite3();
  return new Promise((resolve, reject) => {
    const db = new driver.Database(path, err => err ? reject(err) : resolve(db));
  });
}
const run = (db, sql, values = []) => new Promise((resolve, reject) => db.run(sql, values, err => err ? reject(err) : resolve()));
const get = (db, sql, values = []) => new Promise((resolve, reject) => db.get(sql, values, (err, row) => err ? reject(err) : resolve(row)));
const close = db => new Promise((resolve, reject) => db.close(err => err ? reject(err) : resolve()));

try {
  if (mode === 'neutral-lock') {
    const db = await rawDatabase(args.databasePath);
    await run(db, 'BEGIN IMMEDIATE');
    send('locked');
    process.on('message', async message => {
      if (message === 'release') {
        try { await run(db, 'COMMIT'); await close(db); send('released'); process.exit(0); }
        catch (error) { send('error', error.message); process.exit(1); }
      }
    });
  } else if (mode === 'neutral-lock-probe') {
    const db = await rawDatabase(args.databasePath);
    send('reader_ready');
    send('open_started');
    setTimeout(() => send('observation_window_elapsed'), 350);
    try {
      await run(db, 'BEGIN IMMEDIATE');
      send('callback_entered');
      send('first_read_started');
      await get(db, 'SELECT name FROM sqlite_master ORDER BY name LIMIT 1');
      send('first_read_completed');
      await run(db, 'COMMIT');
      send('result', 'read_completed');
    } finally { await close(db); }
  } else if (mode === 'neutral-write-kill') {
    const db = await rawDatabase(args.databasePath);
    await run(db, 'BEGIN IMMEDIATE');
    await run(db, 'INSERT INTO neutral (id, value) VALUES (?, ?)', [args.id, args.value]);
    send('written_uncommitted');
    process.on('message', async message => {
      if (message === 'commit') {
        if (args.armAckBeforeCommit) process.env.DS_ACK_ARMED = '1';
        await run(db, 'COMMIT'); send('committed');
      }
    });
  } else if (mode === 'neutral-read') {
    const db = await rawDatabase(args.databasePath);
    const row = await get(db, 'SELECT value FROM neutral WHERE id = ?', [args.id]);
    await close(db);
    send('result', row?.value ?? null);
  } else if (mode === 'session-outbox-inspect') {
    send('result', await inspectSessionOutbox(args.databasePath, args.namespace, args.eventId, args.probeWrite === true));
  } else if (mode === 'neutral-sql-fault') {
    const db = await rawDatabase(args.databasePath);
    await run(db, 'BEGIN IMMEDIATE');
    await run(db, 'INSERT INTO neutral (id, value) VALUES (?, ?)', ['prior', 'must-rollback']);
    writeFileSync(process.env.DS_SQL_FAULT_ARM_FILE, 'armed');
    let actualCode;
    try { await run(db, 'INSERT INTO neutral (id, value) VALUES (?, ?)', ['faulted', 'never']); }
    catch (error) { actualCode = error.code; }
    await run(db, 'ROLLBACK');
    await close(db);
    send('result', actualCode);
  } else if (mode === 'candidate-open') {
    const open = await candidate();
    if (args.observeLock) {
      send('reader_ready');
      send('open_started');
      setTimeout(() => send('observation_window_elapsed'), 350);
    }
    const store = await open(options(args.databasePath, 'open'));
    let value;
    if (args.read === 'session') value = await store.sessions.transaction(async tx => {
      if (args.observeLock) { send('callback_entered'); send('first_read_started'); }
      const row = await tx.getSession('tenant-a', args.id);
      if (args.observeLock) send('first_read_completed');
      return row;
    });
    else if (args.read === 'token') value = await store.sessions.transaction(tx => tx.getToken('tenant-a', args.id));
    else if (args.read === 'identity') value = await store.directory.transaction('tenant-a', tx => tx.getIdentity('issuer-a', args.id));
    else value = 'opened';
    send('result', value);
    await store.close();
  } else if (mode === 'candidate-write') {
    const open = await candidate();
    const store = await open(options(args.databasePath, args.create ? 'create' : 'open'));
    if (args.kind === 'session') {
      const result = await store.sessions.transaction(async tx => {
        await tx.insertSession(session(args.id));
        await tx.insertToken(token(args.id));
        await tx.putEvent(sessionEvent(args.id));
        if (args.armAckAfterOpen) armAck();
        return true;
      });
      send('result', result);
    } else {
      const result = await store.directory.transaction('tenant-a', async tx => {
        const didInsert = await tx.insertIdentity(identity(args.id));
        if (didInsert) {
          await tx.putAccountRevision(`account-${args.id}`, null, 1);
          await tx.insertCommand(command(args.id));
          await tx.insertConsent(consent(args.id));
          await tx.insertEvent(directoryEvent(args.id));
        }
        if (args.armAckAfterOpen) armAck();
        return didInsert;
      });
      send('result', result);
      if (args.verifyPoisonAfterUnknown && result?.status === 'unknown') {
        try { send('after_unknown', await store.directory.transaction('tenant-a', tx => tx.countRows())); }
        catch (error) { send('after_unknown_error', { code: error?.code, message: error?.message }); }
      }
    }
    await store.close();
  } else if (mode === 'candidate-hold') {
    const open = await candidate();
    const store = await open(options(args.databasePath, 'open'));
    const pending = store.directory.transaction('tenant-a', async tx => {
      await tx.insertIdentity(identity(args.id));
      send('written_in_callback');
      await new Promise(resolve => process.once('message', resolve));
      return true;
    });
    const value = await pending;
    send('result', value);
    await store.close();
  } else if (mode === 'candidate-refresh') {
    const open = await candidate();
    const store = await open(options(args.databasePath, 'open'));
    const result = await store.sessions.transaction(async tx => {
      const original = await tx.getToken('tenant-a', digest64('token'));
      if (!original || original.state !== 'current') {
        const old = await tx.getSession('tenant-a', id43('session'));
        if (old) await tx.putSession({ ...old, revokedAt: 3, revision: old.revision + 1 });
        await tx.putEvent(sessionEvent('reuse', { kind: 'session_reused', sessionId: id43('session'), revision: 3, at: 3 }));
        return false;
      }
      const old = await tx.getSession('tenant-a', id43('session'));
      await tx.putToken({ ...original, state: 'rotated' });
      await tx.insertToken({ ...token(args.id), sessionId: id43('session') });
      await tx.putSession({ ...old, revision: old.revision + 1, lastSeenAt: 2 });
      await tx.putEvent(sessionEvent(args.id, { kind: 'session_refreshed', sessionId: id43('session'), revision: 2, at: 2 }));
      return true;
    });
    send('result', result);
    await store.close();
  } else if (mode === 'candidate-abort') {
    const open = await candidate();
    const store = await open(options(args.databasePath, 'open'));
    const result = await store.directory.transaction('tenant-a', async tx => {
      await tx.insertIdentity(identity(args.id));
      if (args.armAckAfterOpen) armAck();
      throw new Error('deliberate callback abort');
    });
    send('result', result);
    await store.close();
  } else if (mode === 'candidate-directory-snapshot') {
    const open = await candidate();
    const store = await open(options(args.databasePath, 'open'));
    const result = await store.directory.transaction('tenant-a', async tx => ({
      identity: await tx.getIdentity('issuer-a', 'subject-1'),
      revision: await tx.getAccountRevision('account-1'),
      command: await tx.getCommand(args.commandId),
      consent: await tx.getConsent(args.consentId),
      countRows: await tx.countRows(),
      countPendingEvents: await tx.countPendingEvents(),
    }));
    send('result', result);
    await store.close();
  } else if (mode === 'candidate-caught-sql-failure') {
    const open = await candidate();
    const store = await open(options(args.databasePath, 'open'));
    try {
      const value = await store.sessions.transaction(async tx => {
        await tx.insertSession(session('before-real-sql-error'));
        writeFileSync(process.env.DS_SQL_FAULT_ARM_FILE, 'armed');
        let caught = false;
        try { await tx.putEvent(sessionEvent('after-real-sql-error')); }
        catch { caught = true; }
        send('callback_caught_real_driver_error', caught);
        return 'must-not-commit';
      });
      send('result', value);
    } catch (error) { send('transaction_error', { code: error?.code, message: error?.message }); }
    await store.close();
  } else if (mode === 'candidate-session-ack-loss') {
    const open = await candidate();
    const store = await open(options(args.databasePath, 'open'));
    try {
      const value = await store.sessions.transaction(async tx => {
        await tx.insertSession(session(args.id));
        await tx.insertToken(token(args.id));
        await tx.putEvent(sessionEvent(args.id));
        armAck();
        return 'must-not-return';
      });
      send('result', value);
    } catch (error) { send('transaction_error', { code: error?.code, message: error?.message }); }
    try { send('after_unknown', await store.sessions.transaction(tx => tx.getSession('tenant-a', id43('session', args.id)))); }
    catch (error) { send('after_unknown_error', { code: error?.code, message: error?.message }); }
    await store.close();
  } else {
    throw new Error(`unknown child mode ${mode}`);
  }
} catch (error) {
  send('error', { name: error?.name, code: error?.code, message: error?.message });
  process.exitCode = 1;
}
