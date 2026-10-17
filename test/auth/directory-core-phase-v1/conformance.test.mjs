import assert from 'node:assert/strict';
import test from 'node:test';
import {isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {harness, commandId, identity, identityRow, issuer, issuerB, linkId, nonce, proof, sessionUse} from './fixtures.mjs';

const selected=process.env.YALC_AUTH_DIRECTORY_CANDIDATE;
if(selected&&!isAbsolute(selected))throw Error('YALC_AUTH_DIRECTORY_CANDIDATE must be an absolute ESM path');
const module=await import(selected?pathToFileURL(selected).href:'./unimplemented-baseline.mjs');
if(typeof module.createIdentityDirectory!=='function')throw Error('candidate must export createIdentityDirectory');
const factory=module.createIdentityDirectory;
const deny=(work,code)=>assert.rejects(work,error=>error?.code===code);
const safeDeny=work=>assert.rejects(work,error=>['invalid_input','authentication_denied','authentication_unavailable','authorization_denied','provider_disabled','consent_denied','identity_conflict','command_conflict','capacity_exceeded','storage_unavailable','commit_unknown'].includes(error?.code));
const rows=h=>h.store.snapshot();
const noMutation=h=>assert.deepEqual(rows(h),h.before);
const mark=h=>{h.before=rows(h);return h;};
const keys=(value,names)=>assert.deepEqual(Object.keys(value).sort(),names.sort());
const resultKeys=['status','accountId','linkId','revision','replay'];
const seedAlternate=(h,changes={})=>{h.store.seedIdentity(identityRow({issuer:issuerB,subject:'alt',providerId:'providerB',linkId:linkId(21),...changes}));h.proofs.set('alt',identity('alt',issuerB));};
const useAlternateSession=h=>{h.sessions.set('alt-session',{...h.sessions.get('alice-session'),sessionId:'session-alt',issuer:issuerB,subject:'alt',providerId:'providerB'});h.bindings.set('session-alt',{...h.bindings.get('session-alice'),sessionId:'session-alt',issuer:issuerB,subject:'alt',providerId:'providerB',linkId:linkId(21)});return sessionUse('alt-session');};

test('DIR-T01 DIR-C01 missing port or unsafe limit fails construction',()=>{
  const h=harness(factory);keys(h.directory,['resolveIdentity','provision','link','unlink','list','reconcile','assertCurrentLink']);for(const method of Object.values(h.directory))assert.equal(typeof method,'function');for(const patch of [{verifyProof:null},{capacity:null},{directoryStore:null},{limits:{...h.limits,maxRecordBytes:0}},{limits:{...h.limits,maxRowsPerNamespace:Number.MAX_SAFE_INTEGER}}])
    assert.throws(()=>factory({...h.options,...patch}),error=>error?.code==='invalid_config');
});
test('DIR-T02 DIR-C01 malformed and accessor input never reaches proof or store',async()=>{
  const h=mark(harness(factory));let getter=0;const malformed={providerId:'providerA'};Object.defineProperty(malformed,'proof',{enumerable:true,get(){getter++;return 'alice';}});
  await deny(()=>h.directory.provision({proof:malformed,enrollmentRef:'e',commandId:commandId()}),'invalid_input');
  await deny(()=>h.directory.provision({proof:{...proof(),proof:'x'.repeat(65537)},enrollmentRef:'e',commandId:commandId(10000,2)}),'invalid_input');
  await deny(()=>h.directory.link({...{sessionUse:sessionUse(),currentProof:proof(),targetProof:proof('bob'),consent:'c',commandId:commandId(10000,3)},accountId:'forged'}),'invalid_input');
  assert.equal(getter,0);assert.equal(h.calls.verifyProof.length,0);noMutation(h);
});
test('DIR-T03 DIR-C02 exact issuer and subject resolve one account',async()=>{
  const h=harness(factory);assert.deepEqual(await h.directory.resolveIdentity(identity()),{accountId:'account-alice'});assert.deepEqual(await h.directory.resolveIdentity(identity()),{accountId:'account-alice'});assert.equal(rows(h).identities.length,1);
});
test('DIR-T04 DIR-C02 issuer subject case and path remain distinct',async()=>{
  const h=harness(factory);for(const value of [identity('Alice'),identity('alice',issuer+'/'),identity('alice',issuerB)])assert.equal(await h.directory.resolveIdentity(value),null);assert.equal(rows(h).identities.length,1);
});
test('DIR-T05 DIR-C02/C08 absent unlinked disabled and unknown resolve null without writes',async()=>{
  const h=mark(harness(factory));assert.equal(await h.directory.resolveIdentity(identity('missing')),null);h.store.seedIdentity(identityRow({subject:'old',status:'unlinked',unlinkedAt:10000}));h.before=rows(h);assert.equal(await h.directory.resolveIdentity(identity('old')),null);h.providers.set('providerA',{enabled:false,revision:'p2'});assert.equal(await h.directory.resolveIdentity(identity()),null);h.providers.delete('providerA');assert.equal(await h.directory.resolveIdentity(identity()),null);noMutation(h);
});
test('DIR-T06 DIR-C02 email display and role hints do not match or provision',async()=>{
  const h=mark(harness(factory));const unknown={...identity('other'),email:'alice@example.invalid',display:'Alice',role:'owner'};await deny(()=>h.directory.resolveIdentity(unknown),'invalid_input');assert.equal(await h.directory.resolveIdentity(identity('other')),null);noMutation(h);
});
test('DIR-T07 DIR-C03 missing explicit approval denies without mapping',async()=>{
  const h=mark(harness(factory,{seedActor:false}));h.controls.approvalEnabled=false;await deny(()=>h.provision(),'authorization_denied');assert.equal(h.calls.reserve.length,0);noMutation(h);
});
test('DIR-T08 DIR-C03/C10 explicit provision creates exactly five rows and a detached receipt',async()=>{
  const h=harness(factory,{seedActor:false}),r=await h.provision();keys(r,[...resultKeys]);assert.equal(r.status,'provisioned');assert.equal(r.accountId,'account-alice');assert.equal(r.revision,1);assert.equal(r.replay,false);const s=rows(h);assert.deepEqual([s.identities.length,s.revisions.length,s.commands.length,s.consents.length,s.events.length],[1,1,1,1,1]);assert.equal(s.events[0].kind,'identity_provisioned');assert.equal(s.events[0].delivery,'pending');assert.equal(h.calls.settle.length,1);
});
test('DIR-T09 DIR-C03 competing or replayed approval cannot provision another account',async()=>{
  const h=harness(factory,{seedActor:false});await h.provision();const before=rows(h);h.controls.approvalResult={accountId:'account-other',approvalId:before.consents[0].consentId,commandId:commandId(10000,2),issuedAt:10000,expiresAt:11000};await safeDeny(()=>h.provision(commandId(10000,2),'bob'));assert.deepEqual(rows(h),before);
});
test('DIR-T10 DIR-C04/C11 missing revoked session or grant denies protected methods',async()=>{
  const h=mark(harness(factory));h.sessions.delete('alice-session');for(const run of [()=>h.guard(),()=>h.list(),()=>h.link(),()=>h.unlink(),()=>h.reconcileSession()])await deny(run,'authentication_denied');h.sessions.set('alice-session',{accountId:'account-alice',sessionId:'session-alice',providerId:'providerA',issuer,subject:'alice',authTime:10000,methods:['passkey'],expiresAt:20000});h.controls.grantAllowed=false;for(const run of [()=>h.guard(),()=>h.list(),()=>h.link(),()=>h.unlink(),()=>h.reconcileSession()])await deny(run,'authorization_denied');noMutation(h);
});
test('DIR-T11 DIR-C04 fresh actor proof must match exact session binding',async()=>{
  const h=mark(harness(factory));await deny(()=>h.directory.link({sessionUse:sessionUse(),currentProof:proof('bob'),targetProof:proof('charlie'),consent:'c',commandId:commandId()}),'authentication_denied');assert.equal(h.calls.reserve.length,0);noMutation(h);
});
test('DIR-T12 DIR-C04 stale future malformed and disabled proof cannot mutate',async()=>{
  const h=mark(harness(factory));for(const invalid of [{...identity(),authTime:8999},{...identity(),authTime:10001},{...identity(),methods:[]}] ){h.controls.proofResult=invalid;await deny(()=>h.provision(commandId(10000,2)),'authentication_denied');}h.controls.proofResult=null;h.providers.set('providerA',{enabled:false,revision:'p2'});await deny(()=>h.provision(commandId(10000,3)),'provider_disabled');noMutation(h);
});
test('DIR-T13 DIR-C05/C10 missing wrong expired and consumed consent refuse atomically',async()=>{
  const h=mark(harness(factory));h.controls.consentEnabled=false;await deny(()=>h.link(),'consent_denied');h.controls.consentEnabled=true;h.controls.consentResult={consentId:'c1',commandId:'wrong',issuedAt:10000,expiresAt:11000};await deny(()=>h.link(commandId(10000,2)),'consent_denied');h.controls.consentResult={consentId:'c1',commandId:commandId(10000,3),issuedAt:10000,expiresAt:9999};await deny(()=>h.link(commandId(10000,3)),'consent_denied');noMutation(h);
});
test('DIR-T14 DIR-C06/C10 valid link commits identity revision receipt consent event once',async()=>{
  const h=harness(factory),r=await h.link();keys(r,[...resultKeys]);assert.equal(r.status,'linked');assert.equal(r.accountId,'account-alice');assert.equal(r.revision,2);const s=rows(h);assert.deepEqual([s.identities.length,s.commands.length,s.consents.length,s.events.length],[2,1,1,1]);assert.equal(s.events[0].kind,'identity_linked');assert.equal(s.events[0].delivery,'pending');
});
test('DIR-T15 DIR-C06 concurrent distinct accounts have one identity winner',async()=>{
  const h=harness(factory);h.store.seedIdentity(identityRow({subject:'bob',accountId:'account-bob',linkId:linkId(21)}));h.store.seedRevision('app','account-bob',1);const other=h.directory.link({sessionUse:sessionUse('bob-session'),currentProof:proof('bob'),targetProof:proof('charlie'),consent:'c',commandId:commandId(10000,2)});const one=h.link(commandId(10000,1),'charlie');const outcomes=await Promise.allSettled([one,other]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(rows(h).identities.filter(x=>x.subject==='charlie').length,1);
});
test('DIR-T16 DIR-C06 exact command replay changes no row event or reservation',async()=>{
  const h=harness(factory),id=commandId();const first=await h.link(id),before=rows(h),effects=h.capacitySnapshot();const replay=await h.link(id);assert.deepEqual(replay,{...first,replay:true});assert.deepEqual(rows(h),before);assert.deepEqual(h.capacitySnapshot(),effects);assert.ok(h.calls.reserve.every(call=>call.commandId===id&&call.namespace==='app'));
});
test('DIR-T17 DIR-C06 changed intent under command ID conflicts without disclosure',async()=>{
  const h=harness(factory),id=commandId();await h.link(id);const before=rows(h);await deny(()=>h.link(id,'charlie'),'command_conflict');assert.deepEqual(rows(h),before);
});
test('DIR-T18 DIR-C07 unlink tombstones and does not transfer account',async()=>{
  const h=harness(factory);seedAlternate(h);const r=await h.unlink();assert.equal(r.status,'unlinked');const row=rows(h).identities.find(x=>x.subject==='alt');assert.equal(row.status,'unlinked');assert.equal(row.accountId,'account-alice');assert.equal(row.generation,2);assert.equal(await h.directory.resolveIdentity(identity('alt',issuerB)),null);
});
test('DIR-T19 DIR-C07 last enabled method refuses while alternate permits',async()=>{
  const h=mark(harness(factory));await deny(()=>h.unlink(commandId(),linkId()),'last_method');noMutation(h);seedAlternate(h);const r=await h.unlink(commandId(10000,2),linkId());assert.equal(r.status,'unlinked');
});
test('DIR-T20 DIR-C08 disabled target cannot link; enabled alternate permits old unlink',async()=>{
  const h=mark(harness(factory));h.providers.set('providerB',{enabled:false,revision:'off'});h.proofs.set('alt',identity('alt',issuerB));await deny(()=>h.link(commandId(), 'alt'),'provider_disabled');noMutation(h);seedAlternate(h);h.providers.set('providerB',{enabled:true,revision:'on'});h.providers.set('providerA',{enabled:false,revision:'off'});await deny(()=>h.guard(),'provider_disabled');h.sessions.set('alice-session',{...h.sessions.get('alice-session'),issuer:issuerB,subject:'alt',providerId:'providerB'});h.bindings.set('session-alice',{...h.bindings.get('session-alice'),issuer:issuerB,subject:'alt',providerId:'providerB',linkId:linkId(21)});const r=await h.directory.unlink({sessionUse:sessionUse(),currentProof:proof('alt','providerB'),linkId:linkId(),consent:'consent-receipt',commandId:commandId(10000,2)});assert.equal(r.status,'unlinked');
});
test('DIR-T21 DIR-C09 bounded account-only list has exact public keys',async()=>{
  const h=harness(factory);seedAlternate(h);const r=await h.list();keys(r,['revision','links']);assert.equal(r.revision,1);assert.equal(r.links.length,2);for(const item of r.links)keys(item,['linkId','providerId','issuer','usable','linkedAt']);assert.equal(JSON.stringify(r).includes('alice'),false);
});
test('DIR-T22 DIR-C09 returned snapshots cannot mutate later reads or storage',async()=>{
  const h=harness(factory);const r=await h.list();r.links[0].issuer='forged';r.links.push({forged:true});const fresh=await h.list();assert.equal(fresh.links.length,1);assert.equal(fresh.links[0].issuer,issuer);assert.equal(rows(h).identities[0].issuer,issuer);
});
test('DIR-T23 DIR-C10 failed consent or event insert rolls back all writes',async()=>{
  for(const point of ['insertConsent','insertEvent']){const h=mark(harness(factory));h.store.controls.falseAt=point;await safeDeny(()=>h.link());noMutation(h);assert.equal(h.calls.release.length,1);}
});
test('DIR-T24 DIR-C09/C10 unknown commit fences handle and fresh scoped reconcile',async()=>{
  const h=harness(factory),id=commandId();h.store.controls.outcomeScope='mutation';h.store.controls.outcome='committedThenUnknown';await deny(()=>h.link(id),'commit_unknown');const committed=rows(h);assert.equal(committed.commands.length,1);const reservation=committed.commands[0].reservationId;assert.deepEqual(h.capacitySnapshot(),[{reservationId:reservation,commandId:id,state:'held'}]);await deny(()=>h.link(commandId(10000,2)),'commit_unknown');assert.deepEqual(rows(h),committed);h.store.controls.outcome='normal';const fresh=factory(h.options);const found=await fresh.reconcile({scope:{kind:'session',sessionUse:sessionUse()},commandId:id});assert.equal(found.replay,true);assert.equal(found.linkId,committed.commands[0].result.linkId);assert.equal(h.calls.release.length,0);assert.deepEqual(h.capacitySnapshot(),[{reservationId:reservation,commandId:id,state:'settled'}]);assert.ok(h.calls.settle.some(args=>args[0]===reservation&&args[1]===id)||h.calls.reconcileUnknown.some(args=>args[0]===reservation&&args[1]===id&&args[2]==='committed'),'fresh committed receipt must reconcile exact held reservation');assert.ok(h.calls.reserve.every(call=>call.commandId===id&&call.namespace==='app'));
  const settle=harness(factory),settleId=commandId(10000,3);settle.controls.settleError=Error('synthetic-lost-settle-ack');const first=await settle.link(settleId).then(value=>({value}),error=>({error}));if(first.error)assert.ok(['invalid_input','authentication_denied','authentication_unavailable','authorization_denied','provider_disabled','consent_denied','identity_conflict','command_conflict','capacity_exceeded','storage_unavailable','commit_unknown'].includes(first.error.code));else assert.equal(first.value.status,'linked');const settledRow=rows(settle).commands[0];assert.equal(settledRow.commandId,settleId);assert.deepEqual(settle.capacitySnapshot(),[{reservationId:settledRow.reservationId,commandId:settleId,state:'held'}]);assert.equal(settle.calls.release.length,0);settle.controls.settleError=null;const reconciled=await factory(settle.options).reconcile({scope:{kind:'session',sessionUse:sessionUse()},commandId:settleId});assert.equal(reconciled.replay,true);assert.deepEqual(settle.capacitySnapshot(),[{reservationId:settledRow.reservationId,commandId:settleId,state:'settled'}]);assert.equal(settle.calls.release.length,0);assert.ok(settle.calls.settle.some(args=>args[0]===settledRow.reservationId&&args[1]===settleId)||settle.calls.reconcileUnknown.some(args=>args[0]===settledRow.reservationId&&args[1]===settleId&&args[2]==='committed'),'lost settle acknowledgement needs exact receipt-based economic reconciliation');assert.ok(settle.calls.reserve.every(call=>call.commandId===settleId&&call.namespace==='app'));
});
test('DIR-T25 DIR-C11 revocation before last check denies mutation',async()=>{
  const h=mark(harness(factory));let once=true;h.controls.onReserve=async()=>{if(once){once=false;h.controls.grantAllowed=false;}};await deny(()=>h.link(),'authorization_denied');noMutation(h);
});
test('DIR-T26 DIR-C11 post-check revocation may race but later guard denies',async()=>{
  const h=harness(factory);let release,entered;const gate=new Promise(r=>{release=r;});const ready=new Promise(r=>{entered=r;});h.store.controls.beforeCommit=async()=>{entered();await gate;};
  const pending=Promise.resolve().then(()=>h.link()).then(value=>({status:'fulfilled',value}),error=>({status:'rejected',error}));
  let timer;const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'timeout'}),2000);});
  try {
    const first=await Promise.race([ready.then(()=>({status:'entered'})),pending.then(outcome=>({status:'early',outcome})),timeout]);
    assert.equal(first.status,'entered','candidate must reach the precommit barrier without early rejection or hanging');
    h.controls.grantAllowed=false;
  } finally {release();clearTimeout(timer);}
  let finishTimer;const finished=await Promise.race([pending,new Promise(resolve=>{finishTimer=setTimeout(()=>resolve({status:'timeout'}),2000);})]);clearTimeout(finishTimer);assert.notEqual(finished.status,'timeout','post-barrier work must settle');const outcome=finished;
  if(outcome.status==='fulfilled')assert.equal(outcome.value.status,'linked');
  else assert.ok(['authorization_denied','authentication_denied','provider_disabled','commit_unknown'].includes(outcome.error?.code),'post-check race may safely deny');
  await deny(()=>h.guard(),'authorization_denied');
});
test('DIR-T27 DIR-C12 unknown or refused quote and reservation leave no directory rows',async()=>{
  const h=mark(harness(factory));h.controls.quoteResult={quoteId:'q',upperLogicalBytes:1,admittedLifetimeUntil:11000,footprintVersion:'auth-directory.rows.v3'};await safeDeny(()=>h.link());h.controls.quoteResult=null;h.controls.reserveError=Error('synthetic-no-funds');await safeDeny(()=>h.link(commandId(10000,2)));noMutation(h);
});
test('DIR-T28 DIR-C12 row receipt and pending-event pressure never prunes',async()=>{
  for(const [field,value] of [['maxRowsPerNamespace',2],['maxCommandReceiptsPerAccount',1],['maxPendingEvents',1]]){const h=mark(harness(factory,{options:{limits:{maxFreshProofAgeMs:1000,maxLinksPerAccount:32,maxCommandReceiptsPerAccount:field==='maxCommandReceiptsPerAccount'?value:4096,maxPendingEvents:field==='maxPendingEvents'?value:4096,maxRecordBytes:16384,maxConcurrentCommands:8,replayWindowMs:1000,maxRowsPerNamespace:field==='maxRowsPerNamespace'?value:1000}}}));if(field==='maxCommandReceiptsPerAccount')h.store.seedCommand({namespace:'app',commandId:'old',accountId:'account-alice',action:'link',intentDigest:'0'.repeat(64),result:{status:'linked',accountId:'account-alice',linkId:linkId(22),revision:1,replay:false},reservationId:'r',eventId:'e',expiresAt:11000});if(field==='maxPendingEvents')h.store.seedEvent({eventId:'e',namespace:'app',kind:'identity_linked',accountId:'account-alice',linkId:linkId(22),providerId:'providerA',revision:1,at:10000,commandId:'old',delivery:'pending'});h.before=rows(h);await deny(()=>h.link(),'capacity_exceeded');noMutation(h);}
});
test('DIR-T29 DIR-C02/C08 stored route mismatch denies resolution and mutation',async()=>{
  const h=mark(harness(factory));h.routes.set(issuer,{providerId:'providerB',revision:'moved'});assert.equal(await h.directory.resolveIdentity(identity()),null);await safeDeny(()=>h.link());noMutation(h);
});
test('DIR-T30 DIR-C02/C08 disabled canonical route has no alias fallback',async()=>{
  const h=mark(harness(factory));h.providers.set('providerA',{enabled:false,revision:'disabled'});h.routes.set(issuer,{providerId:'providerA',revision:'route'});h.providers.set('providerB',{enabled:true,revision:'alias'});assert.equal(await h.directory.resolveIdentity(identity()),null);await deny(()=>h.guard(),'provider_disabled');noMutation(h);
});
test('DIR-T31 DIR-C11 stale issued generation blocks guarded dispatch',async()=>{
  const h=mark(harness(factory));h.store.seedIdentity(identityRow({status:'unlinked',generation:2,unlinkedAt:10000}));h.before=rows(h);await deny(()=>h.guard(),'authentication_denied');assert.equal(rows(h).events.length,0);noMutation(h);
});
test('DIR-T32 DIR-C11 same identity relink never revives old session binding',async()=>{
  const h=harness(factory);seedAlternate(h);const alt=useAlternateSession(h);const oldBinding={...h.bindings.get('session-alice')};
  const unlinked=await h.directory.unlink({sessionUse:alt,currentProof:proof('alt','providerB'),linkId:linkId(),consent:'consent-receipt',commandId:commandId()});assert.equal(unlinked.status,'unlinked');assert.equal(rows(h).identities.find(row=>row.subject==='alice').generation,2);await deny(()=>h.guard(),'authentication_denied');
  const relinked=await h.directory.link({sessionUse:alt,currentProof:proof('alt','providerB'),targetProof:proof('alice'),consent:'consent-receipt',commandId:commandId(10000,2)});assert.equal(relinked.status,'linked');const current=rows(h).identities.find(row=>row.subject==='alice');assert.equal(current.generation,3);assert.deepEqual(h.bindings.get('session-alice'),oldBinding);await deny(()=>h.guard(),'authentication_denied');
  h.sessions.set('fresh-session',{...h.sessions.get('alice-session'),sessionId:'session-fresh'});h.bindings.set('session-fresh',{...oldBinding,sessionId:'session-fresh',generation:3});const fresh=await h.directory.assertCurrentLink({sessionUse:sessionUse('fresh-session')});assert.equal(fresh.generation,3);
});
test('DIR-T33 DIR-C06 link ID collision and stale CAS roll back all writes',async()=>{
  const h=mark(harness(factory,{options:{randomBytes:()=>new Uint8Array(32).fill(31)}}));h.store.seedIdentity(identityRow({issuer:issuerB,subject:'other',providerId:'providerB',linkId:nonce(31)}));h.before=rows(h);await safeDeny(()=>h.link());noMutation(h);
  const stale=mark(harness(factory));stale.store.controls.falseAt='putAccountRevision';await safeDeny(()=>stale.link());noMutation(stale);
  const reactivation=harness(factory);seedAlternate(reactivation);const alt=useAlternateSession(reactivation);await reactivation.directory.unlink({sessionUse:alt,currentProof:proof('alt','providerB'),linkId:linkId(),consent:'consent-receipt',commandId:commandId()});mark(reactivation);reactivation.store.controls.falseAt='updateIdentity';await safeDeny(()=>reactivation.directory.link({sessionUse:alt,currentProof:proof('alt','providerB'),targetProof:proof('alice'),consent:'consent-receipt',commandId:commandId(10000,2)}));noMutation(reactivation);
});
test('DIR-T34 DIR-C09 malformed trusted port and store return yields no grant',async()=>{
  let invoked=0;const poison=value=>{const row={...value};Object.defineProperty(row,'extra',{enumerable:true,get(){invoked++;return 'SECRET-GETTER';}});return row;};
  for(const [field,value,run] of [
    ['proofResult',identity(),h=>h.provision()],['routeResult',{providerId:'providerA',revision:'r'},h=>h.directory.resolveIdentity(identity())],
    ['providerResult',{enabled:true,revision:'r'},h=>h.guard()],['sessionResult',{accountId:'account-alice',sessionId:'session-alice',providerId:'providerA',issuer,subject:'alice',authTime:10000,methods:['passkey'],expiresAt:20000},h=>h.guard()],
    ['bindingResult',{namespace:'app',sessionId:'session-alice',accountId:'account-alice',issuer,subject:'alice',providerId:'providerA',linkId:linkId(),generation:1},h=>h.guard()],
    ['grantResult',{allowed:true,revision:'r'},h=>h.guard()],['approvalResult',{accountId:'account-alice',approvalId:'a',commandId:commandId(),issuedAt:10000,expiresAt:11000},h=>h.provision()],
    ['consentResult',{consentId:'c',commandId:commandId(),issuedAt:10000,expiresAt:11000},h=>h.link()],
    ['quoteResult',{quoteId:'q',upperLogicalBytes:81920,admittedLifetimeUntil:11000,footprintVersion:'auth-directory.rows.v3'},h=>h.link()],
    ['reserveResult',{reservationId:'r'},h=>h.link()],
  ]){const h=mark(harness(factory));h.controls[field]=poison(value);await safeDeny(()=>run(h));noMutation(h);assert.equal(invoked,0,`${field} getter invoked`);}
  for(const [method,raw,prepare,run] of [
    ['getIdentity',poison(identityRow()),()=>{},h=>h.guard()],
    ['getCommand',poison({namespace:'app',commandId:commandId(),accountId:'account-other',action:'link',intentDigest:'0'.repeat(64),result:{status:'linked',accountId:'account-other',linkId:linkId(),revision:2,replay:false},reservationId:'r',eventId:'e',expiresAt:11000}),()=>{},h=>h.link()],
    ['getLink',poison(identityRow({accountId:'account-other',issuer:issuerB,subject:'alt',providerId:'providerB',linkId:linkId(21)})),h=>seedAlternate(h),h=>h.unlink()],
    ['listLinks',[poison(identityRow({accountId:'account-other'}))],()=>{},h=>h.list()],
    ['getConsent',poison({namespace:'app',consentId:'foreign',commandId:commandId(),expiresAt:11000}),()=>{},h=>h.link()],
    ['getAccountRevision',poison({revision:1}),()=>{},h=>h.list()],
    ['countRows',poison({count:1}),()=>{},h=>h.link()],
    ['countLinks',poison({count:1}),()=>{},h=>h.link()],
    ['countCommands',poison({count:1}),()=>{},h=>h.link()],
    ['countPendingEvents',poison({count:1}),()=>{},h=>h.link()],
  ]){const h=mark(harness(factory));prepare(h);h.before=rows(h);h.store.controls.readAt=method;h.store.controls.readValue=raw;const writes=h.store.controls.writes.length;await safeDeny(()=>run(h));assert.ok(h.store.controls.reads.includes(method),`${method} was not reached`);assert.equal(invoked,0,`${method} getter invoked`);assert.equal(h.store.controls.writes.length,writes,`${method} caused write`);noMutation(h);}
});
test('DIR-T35 DIR-C03/C09 provision reconcile requires fresh proof and current approval',async()=>{
  const h=harness(factory,{seedActor:false});const id=commandId();await h.provision(id);const before=rows(h);assert.deepEqual(await h.reconcileProvision(id),{...before.commands[0].result,replay:true});h.controls.approvalEnabled=false;await deny(()=>h.reconcileProvision(id),'authorization_denied');assert.deepEqual(rows(h),before);
});
test('DIR-T36 DIR-C12 quote has exact vector, horizon and rejects physical-cost refusal',async()=>{
  const h=harness(factory);await h.link();const q=h.calls.quote[0];assert.deepEqual(q.logicalFootprint,['identity','accountRevision','command','consent','event'].map(kind=>({kind,upperBytes:h.limits.maxRecordBytes})));assert.equal(q.replayUntil,11000);assert.equal(q.class,'auth-core');assert.equal(q.intentDigest.length,64);const other=harness(factory);other.controls.quoteResult={quoteId:'q',upperLogicalBytes:5*other.limits.maxRecordBytes,admittedLifetimeUntil:10999,footprintVersion:'auth-directory.rows.v3'};await deny(()=>other.link(),'capacity_exceeded');
});
test('DIR-T37 DIR-C10/C12 confirmed abort releases, committed result settles',async()=>{
  const h=harness(factory),ids=[commandId(),commandId(10000,2),commandId(10000,3)];h.store.controls.falseAt='insertEvent';await safeDeny(()=>h.link(ids[0]));await safeDeny(()=>h.link(ids[1]));assert.deepEqual(h.capacitySnapshot(),[{reservationId:'reservation-1',commandId:ids[0],state:'released'},{reservationId:'reservation-2',commandId:ids[1],state:'released'}]);assert.ok(h.calls.release.some(args=>args[0]==='reservation-1'&&args[1]===ids[0]));assert.ok(h.calls.release.some(args=>args[0]==='reservation-2'&&args[1]===ids[1]));assert.equal(h.calls.settle.length,0);h.store.controls.falseAt=null;
  const released=h.capacitySnapshot(),beforeRetry=rows(h),retry=factory(h.options);
  await safeDeny(()=>retry.link({sessionUse:sessionUse(),currentProof:proof('alice'),targetProof:proof('bob'),consent:'consent-receipt',commandId:ids[0]}));
  assert.deepEqual(h.capacitySnapshot(),released);assert.deepEqual(rows(h),beforeRetry);
  await h.link(ids[2]);assert.deepEqual(h.capacitySnapshot(),[{reservationId:'reservation-1',commandId:ids[0],state:'released'},{reservationId:'reservation-2',commandId:ids[1],state:'released'},{reservationId:'reservation-3',commandId:ids[2],state:'settled'}]);assert.ok(h.calls.settle.some(args=>args[0]==='reservation-3'&&args[1]===ids[2]));assert.ok(h.calls.reserve.every(call=>ids.includes(call.commandId)&&call.namespace==='app'));
  const uncertain=harness(factory),uncertainId=commandId(10000,4);uncertain.store.controls.falseAt='insertEvent';uncertain.store.controls.outcomeScope='mutation';uncertain.store.controls.outcome='unknown';await deny(()=>uncertain.link(uncertainId),'commit_unknown');assert.deepEqual(uncertain.capacitySnapshot(),[{reservationId:'reservation-1',commandId:uncertainId,state:'held'}]);assert.equal(uncertain.calls.release.length,0);assert.equal(uncertain.calls.settle.length,0);
});
test('DIR-T38 DIR-C10/C12 injected unknown holds reservation; missing receipt is not abort proof',async()=>{
  for(const outcome of ['unknown','reject','malformed','accessor','missingValue','foreignValue']){
    const h=harness(factory);h.store.controls.outcomeScope='mutation';h.store.controls.outcome=outcome;h.store.controls.foreignValue={status:'linked',accountId:'account-other',linkId:linkId(22),revision:999,replay:false};
    await deny(()=>h.link(),'commit_unknown');assert.equal(h.store.controls.outcomeGetterCalls,0);assert.equal(h.calls.reserve.length,1);assert.equal(h.calls.release.length,0);assert.equal(h.calls.settle.length,0);assert.equal(rows(h).commands.length,0);
    await deny(()=>h.link(commandId(10000,2)),'commit_unknown');h.store.controls.outcome='normal';const fresh=factory(h.options);assert.equal(await fresh.reconcile({scope:{kind:'session',sessionUse:sessionUse()},commandId:commandId()}),null);assert.equal(h.calls.reconcileUnknown.length,0);
  }
  const read=harness(factory);read.store.controls.outcome='unknown';await deny(()=>read.directory.resolveIdentity(identity()),'commit_unknown');await deny(()=>read.link(),'commit_unknown');assert.equal(read.calls.release.length,0);assert.equal(read.calls.reserve.length,0);
  const failure=harness(factory);failure.store.controls.falseAt='insertEvent';failure.store.controls.outcomeScope='mutation';failure.store.controls.outcome='committedAfterCallbackFailure';failure.store.controls.foreignValue={status:'linked',accountId:'account-alice',linkId:linkId(22),revision:2,replay:false};await deny(()=>failure.link(),'commit_unknown');assert.equal(failure.calls.release.length,0);
});
test('DIR-T39 DIR-C10/C12 modeled acknowledged transition frees pending admission only',async()=>{
  const h=harness(factory,{options:{limits:{maxFreshProofAgeMs:1000,maxLinksPerAccount:32,maxCommandReceiptsPerAccount:4096,maxPendingEvents:1,maxRecordBytes:16384,maxConcurrentCommands:8,replayWindowMs:1000,maxRowsPerNamespace:1000}}});h.store.seedEvent({eventId:'old',namespace:'app',kind:'identity_linked',accountId:'account-alice',linkId:linkId(22),providerId:'providerA',revision:1,at:9999,commandId:'old',delivery:'pending'});await deny(()=>h.link(),'capacity_exceeded');h.store.modelAcknowledge('old');const r=await h.link(commandId(10000,2));assert.equal(r.status,'linked');assert.equal(rows(h).events.find(x=>x.eventId==='old').delivery,'acknowledged');
});
test('DIR-T40 DIR-C06/C10/C12 model compaction cannot revive expired command',async()=>{
  const h=harness(factory);await h.link();const event=rows(h).events[0];h.store.modelAcknowledge(event.eventId);h.setTime(11000);h.store.modelCompactExpired(11000,11000);const before=rows(h),reads=h.store.controls.reads.length;await deny(()=>h.link(),'command_expired');assert.deepEqual(rows(h),before);assert.equal(h.store.controls.reads.length,reads);
});
test('DIR-T41 DIR-C01/C12 canonical time-bearing ID and exact expiry reject before storage',async()=>{
  const h=mark(harness(factory));for(const id of ['010000.'+nonce(),'10001.'+nonce(), '10000.bad', `${Number.MAX_SAFE_INTEGER}.${nonce()}`])await deny(()=>h.provision(id),'invalid_input');h.setTime(11000);await deny(()=>h.provision(commandId()),'command_expired');assert.equal(h.calls.reserve.length,0);noMutation(h);
});
test('DIR-T42 DIR-C03/C05/C12 approval and consent bind exact command and deadline',async()=>{
  const h=mark(harness(factory));h.controls.approvalResult={accountId:'account-alice',approvalId:'approval',commandId:commandId(10000,2),issuedAt:10000,expiresAt:11000};await deny(()=>h.provision(commandId()),'authorization_denied');h.controls.consentResult={consentId:'consent',commandId:commandId(),issuedAt:10000,expiresAt:10999};await deny(()=>h.link(),'consent_denied');noMutation(h);
  const linked=harness(factory),linkCommand=commandId(10000,3);linked.controls.onVerifyConsent=input=>assert.deepEqual(input,{receipt:'consent-receipt',action:'link',accountId:'account-alice',commandId:linkCommand,target:{providerId:'providerA',issuer,subject:'bob'}});assert.equal((await linked.link(linkCommand)).status,'linked');assert.ok(linked.calls.verifyConsent.length>0);
  const unlinked=harness(factory),unlinkCommand=commandId(10000,4);seedAlternate(unlinked);unlinked.controls.onVerifyConsent=input=>assert.deepEqual(input,{receipt:'consent-receipt',action:'unlink',accountId:'account-alice',commandId:unlinkCommand,target:{providerId:'providerB',linkId:linkId(21)}});assert.equal((await unlinked.unlink(unlinkCommand)).status,'unlinked');assert.ok(unlinked.calls.verifyConsent.length>0);
});
test('DIR-T43 DIR-C01/C10/C12 five-row footprint and row cap include acknowledged events',async()=>{
  const h=harness(factory,{options:{limits:{maxFreshProofAgeMs:1000,maxLinksPerAccount:32,maxCommandReceiptsPerAccount:4096,maxPendingEvents:4096,maxRecordBytes:16384,maxConcurrentCommands:8,replayWindowMs:1000,maxRowsPerNamespace:6}}});h.store.seedEvent({eventId:'ack',namespace:'app',kind:'identity_linked',accountId:'account-alice',linkId:linkId(22),providerId:'providerA',revision:1,at:9999,commandId:'old',delivery:'acknowledged'});const before=rows(h);await deny(()=>h.link(),'capacity_exceeded');assert.deepEqual(rows(h),before);assert.equal(h.calls.quote.length,0);
});
test('DIR-T44 DIR-C10/C12 local backward or unknown clock fences writes and holds',async()=>{
  const h=harness(factory);await h.link();const before=rows(h),reserved=h.calls.reserve.length;h.setTime(9999);await safeDeny(()=>h.link(commandId(9999,2)));assert.deepEqual(rows(h),before);h.setTime(Number.NaN);await safeDeny(()=>h.link(commandId(10000,3)));assert.equal(h.calls.reserve.length,reserved);
});
