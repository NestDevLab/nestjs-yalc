import assert from 'node:assert/strict';
import test from 'node:test';
import {harness,identityRow,linkId,memoryDirectoryStore,nonce} from './fixtures.mjs';
import {createIdentityDirectory} from './unimplemented-baseline.mjs';

test('neutral capacity records one economic effect per exact idempotent binding',async()=>{
  const h=harness(createIdentityDirectory),input={namespace:'app',accountId:'account-alice',commandId:'command-1',intentDigest:'a'.repeat(64),quote:{quoteId:'q'},class:'auth-core'};
  assert.deepEqual(await h.options.capacity.reserveGrowth(input),{reservationId:'reservation-1'});assert.deepEqual(await h.options.capacity.reserveGrowth(input),{reservationId:'reservation-1'});
  assert.deepEqual(h.capacitySnapshot(),[{reservationId:'reservation-1',commandId:'command-1',state:'held'}]);await h.options.capacity.settle('reservation-1','command-1');await h.options.capacity.settle('reservation-1','command-1');assert.deepEqual(h.capacitySnapshot(),[{reservationId:'reservation-1',commandId:'command-1',state:'settled'}]);
  await assert.rejects(()=>h.options.capacity.reserveGrowth({...input,intentDigest:'b'.repeat(64)}),/intent-conflict/);await assert.rejects(()=>h.options.capacity.releaseConfirmedAbort('reservation-1','foreign'),/binding/);
});

test('neutral store serializes namespaces and rolls failed writes back together',async()=>{
  const store=memoryDirectoryStore(),row=identityRow();let release,entered;
  const gate=new Promise(r=>{release=r;});const ready=new Promise(r=>{entered=r;});
  const first=store.transaction('app',async tx=>{assert.equal(await tx.insertIdentity(row),true);entered();await gate;throw Error('abort');});
  await ready;let secondEntered=false;
  const second=store.transaction('app',async tx=>{secondEntered=true;assert.equal(await tx.getIdentity(row.issuer,row.subject),null);return tx.insertIdentity(row);});
  await Promise.resolve();assert.equal(secondEntered,false);release();assert.deepEqual(await first,{status:'confirmed_abort'});assert.deepEqual(await second,{status:'committed',value:true});assert.equal(store.snapshot().identities.length,1);
});
test('neutral uniqueness and generation CAS reject without modifying rows',async()=>{
  const store=memoryDirectoryStore(),row=identityRow();await store.transaction('app',tx=>tx.insertIdentity(row));
  const before=store.snapshot();assert.deepEqual(await store.transaction('app',async tx=>{assert.equal(await tx.insertIdentity(row),false);assert.equal(await tx.insertIdentity(identityRow({subject:'other',linkId:row.linkId})),false);assert.equal(await tx.updateIdentity(2,{...row,generation:3}),false);}),{status:'committed',value:undefined});assert.deepEqual(store.snapshot(),before);
});
test('neutral pending count includes only pending events; total count includes acknowledged rows',async()=>{
  const store=memoryDirectoryStore(),event={eventId:'e',namespace:'app',kind:'identity_linked',accountId:'a',linkId:linkId(),providerId:'providerA',revision:1,at:10000,commandId:'c',delivery:'pending'};
  await store.transaction('app',tx=>tx.insertEvent(event));assert.deepEqual(await store.transaction('app',tx=>tx.countPendingEvents()),{status:'committed',value:1});assert.deepEqual(await store.transaction('app',tx=>tx.countRows()),{status:'committed',value:1});store.modelAcknowledge('e');assert.deepEqual(await store.transaction('app',tx=>tx.countPendingEvents()),{status:'committed',value:0});assert.deepEqual(await store.transaction('app',tx=>tx.countRows()),{status:'committed',value:1});
});
test('host controls expose raw adversarial records without touching getters',async()=>{
  const h=harness(createIdentityDirectory);let reads=0;const raw={allowed:true};Object.defineProperty(raw,'revision',{enumerable:true,get(){reads++;return 'bad';}});h.controls.grantResult=raw;
  const returned=await h.options.authorize({action:'guard',namespace:'app',accountId:'account-alice',sessionId:'session-alice'});assert.equal(returned,raw);assert.equal(reads,0);h.store.controls.readAt='getIdentity';h.store.controls.readValue=raw;const fromStore=await h.store.transaction('app',tx=>tx.getIdentity('x','y'));assert.equal(fromStore.status,'committed');assert.equal(fromStore.value,raw);assert.equal(reads,0);
});
test('fixture compaction is explicit, requires deadline and never changes identity rows',async()=>{
  const store=memoryDirectoryStore(),row=identityRow();store.seedIdentity(row);store.seedCommand({namespace:'app',commandId:'c',accountId:'a',action:'link',intentDigest:'0'.repeat(64),result:{},reservationId:'r',eventId:'e',expiresAt:11000});store.seedConsent({namespace:'app',consentId:'c',commandId:'c',expiresAt:11000});store.seedEvent({eventId:'e',namespace:'app',kind:'identity_linked',accountId:'a',linkId:nonce(),providerId:'providerA',revision:1,at:10000,commandId:'c',delivery:'acknowledged'});
  assert.throws(()=>store.modelCompactExpired(11000,10999));store.modelCompactExpired(11000,11000);const s=store.snapshot();assert.deepEqual([s.identities.length,s.commands.length,s.consents.length,s.events.length],[1,0,0,0]);
});
test('closed fixture outcomes distinguish committed snapshots, confirmed abort and lost ACK',async()=>{
  const row=identityRow();const committed=memoryDirectoryStore();
  assert.deepEqual(await committed.transaction('app',tx=>tx.insertIdentity(row)),{status:'committed',value:true});assert.equal(committed.snapshot().identities.length,1);
  const aborted=memoryDirectoryStore();aborted.controls.falseAt='insertIdentity';assert.deepEqual(await aborted.transaction('app',async tx=>{if(await tx.insertIdentity(row)!==true)throw Error('callback abort');}),{status:'confirmed_abort'});assert.equal(aborted.snapshot().identities.length,0);
  const uncertain=memoryDirectoryStore();uncertain.controls.outcome='committedThenUnknown';assert.deepEqual(await uncertain.transaction('app',tx=>tx.insertIdentity(row)),{status:'unknown'});assert.equal(uncertain.snapshot().identities.length,1);
});
test('rejected, malformed, accessor and missing-value envelopes are distinguishable fixture inputs',async()=>{
  const store=memoryDirectoryStore();for(const [mode,expected] of [['unknown',{status:'unknown'}],['malformed',{status:'committed',value:undefined,extra:true}],['missingValue',{status:'committed'}],['confirmed_abort',{status:'confirmed_abort'}]]){store.controls.outcome=mode;assert.deepEqual(await store.transaction('app',async()=>undefined),expected);}
  store.controls.outcome='accessor';const raw=await store.transaction('app',async()=>undefined);assert.ok(Object.getOwnPropertyDescriptor(raw,'status').get);assert.equal(store.controls.outcomeGetterCalls,0);
  store.controls.outcome='reject';await assert.rejects(()=>store.transaction('app',async()=>undefined),error=>error?.code==='storage_unavailable');
});

test('neutral released reservations cannot fund retries or cross terminal states', async () => {
  const h = harness(createIdentityDirectory);
  const input = {namespace:'app', accountId:'account-alice', commandId:'terminal-command-1',
    intentDigest:'a'.repeat(64), quote:{quoteId:'q'}, class:'auth-core'};
  const {reservationId} = await h.options.capacity.reserveGrowth(input);
  await h.options.capacity.releaseConfirmedAbort(reservationId, input.commandId);
  const released = h.capacitySnapshot();
  await assert.rejects(() => h.options.capacity.reserveGrowth(input));
  assert.deepEqual(h.capacitySnapshot(), released);
  await assert.rejects(() => h.options.capacity.settle(reservationId, input.commandId));
  await assert.rejects(() => h.options.capacity.reconcileUnknown(reservationId, input.commandId, 'committed'));
  await h.options.capacity.releaseConfirmedAbort(reservationId, input.commandId);
  assert.deepEqual(h.capacitySnapshot(), released);

  const fresh = {...input, commandId:'terminal-command-2'};
  const next = await h.options.capacity.reserveGrowth(fresh);
  assert.notEqual(next.reservationId, reservationId);
  assert.equal(h.capacitySnapshot().find(x => x.reservationId === next.reservationId).state, 'held');
  await h.options.capacity.settle(next.reservationId, fresh.commandId);
  const settled = h.capacitySnapshot();
  await assert.rejects(() => h.options.capacity.releaseConfirmedAbort(next.reservationId, fresh.commandId));
  await assert.rejects(() => h.options.capacity.reconcileUnknown(next.reservationId, fresh.commandId, 'confirmed_abort'));
  await assert.rejects(() => h.options.capacity.reconcileUnknown(next.reservationId, fresh.commandId, 'invalid'));
  await assert.rejects(() => h.options.capacity.settle(next.reservationId, 'foreign-command'));
  await h.options.capacity.settle(next.reservationId, fresh.commandId);
  assert.deepEqual(await h.options.capacity.reserveGrowth(fresh), next);
  assert.deepEqual(h.capacitySnapshot(), settled);
});
