import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { memoryDirectoryStore, identityRow } = await import(process.env.DIRECTORY_FIXTURE_CANDIDATE
  ? pathToFileURL(process.env.DIRECTORY_FIXTURE_CANDIDATE).href : './fixtures.mjs');

for (const outcome of ['unknown', 'reject', 'malformed', 'accessor', 'missingValue', 'foreignValue']) {
  test(`PHASE-${outcome} mutation-only fault preserves earlier committed read`, async () => {
    const store = memoryDirectoryStore();
    store.controls.outcomeScope = 'mutation';
    store.controls.outcome = outcome;
    store.controls.foreignValue = { substituted: true };
    const read = await store.transaction('app', tx => tx.countRows());
    assert.deepEqual(read, { status: 'committed', value: 0 });
    const pending = store.transaction('app', tx => tx.insertIdentity(identityRow()));
    if (outcome === 'reject') await assert.rejects(pending, /synthetic-unclassified/);
    else {
      const result = await pending;
      if (outcome === 'accessor') {
        assert.equal(typeof Object.getOwnPropertyDescriptor(result, 'status').get, 'function');
        assert.equal(store.controls.outcomeGetterCalls, 0);
      } else if (outcome === 'unknown') assert.deepEqual(result, { status: 'unknown' });
      else if (outcome === 'malformed') assert.deepEqual(result, { status: 'committed', value: true, extra: true });
      else if (outcome === 'missingValue') assert.deepEqual(result, { status: 'committed' });
      else assert.deepEqual(result, { status: 'committed', value: { substituted: true } });
    }
    assert.equal(store.controls.transactions, 2);
    assert.equal(store.controls.writes.length, 1);
    assert.equal(store.snapshot().identities.length, 0);
  });
}

test('PHASE-read unknown read remains globally injected and performs no write', async () => {
  const store = memoryDirectoryStore();
  store.controls.outcome = 'unknown';
  assert.deepEqual(await store.transaction('app', tx => tx.countRows()), { status: 'unknown' });
  assert.equal(store.controls.writes.length, 0);
});

test('PHASE-callback failed mutation retains its explicitly injected unknown outcome', async () => {
  const store = memoryDirectoryStore();
  store.controls.falseAt = 'insertEvent';
  store.controls.outcomeScope = 'mutation';
  store.controls.outcome = 'unknown';
  assert.deepEqual(await store.transaction('app', tx => tx.countRows()), { status: 'committed', value: 0 });
  const result = await store.transaction('app', async tx => {
    assert.equal(await tx.insertEvent({ namespace: 'app', eventId: 'fixture-event' }), false);
    throw new Error('controlled callback denial');
  });
  assert.deepEqual(result, { status: 'unknown' });
  assert.equal(store.controls.callbackFailures.length, 1);
  assert.equal(store.snapshot().events.length, 0);
});


test('PHASE-committedThenUnknown applies mutation before losing its acknowledgement', async () => {
  const store = memoryDirectoryStore();
  store.controls.outcomeScope = 'mutation';
  store.controls.outcome = 'committedThenUnknown';
  assert.deepEqual(await store.transaction('app', tx => tx.countRows()), { status: 'committed', value: 0 });
  assert.deepEqual(await store.transaction('app', tx => tx.insertIdentity(identityRow())), { status: 'unknown' });
  assert.equal(store.snapshot().identities.length, 1);
});

test('PHASE-committedAfterCallbackFailure remains a malformed mutation outcome', async () => {
  const store = memoryDirectoryStore();
  store.controls.outcomeScope = 'mutation';
  store.controls.outcome = 'committedAfterCallbackFailure';
  store.controls.foreignValue = { substituted: true };
  assert.deepEqual(await store.transaction('app', tx => tx.countRows()), { status: 'committed', value: 0 });
  const result = await store.transaction('app', async tx => {
    await tx.insertIdentity(identityRow());
    throw new Error('controlled callback denial');
  });
  assert.deepEqual(result, { status: 'committed', value: { substituted: true } });
  assert.equal(store.snapshot().identities.length, 0);
  assert.equal(store.controls.callbackFailures.length, 1);
});
