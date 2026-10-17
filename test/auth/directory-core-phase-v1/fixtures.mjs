import {Buffer} from 'node:buffer';

// Neutral, in-memory ports. This is neither a durable adapter nor directory policy.
const copy = value => value === null || value === undefined ? value : structuredClone(value);
const key = (...parts) => JSON.stringify(parts);
export const issuer = 'https://issuer.example';
export const issuerB = 'https://other.example';
export const nonce = (byte = 1) => Buffer.alloc(32, byte).toString('base64url');
export const commandId = (issuedAt = 10_000, byte = 1) => `${issuedAt}.${nonce(byte)}`;
export const linkId = (byte = 20) => nonce(byte);
export const proof = (value = 'alice', providerId = 'providerA') => ({providerId, proof:value});
export const sessionUse = (token = 'alice-session') => ({token, context:{transport:'test'}});
export const identity = (subject = 'alice', route = issuer) => ({issuer:route, subject, authTime:10_000, methods:['passkey']});
export const identityRow = (changes = {}) => ({namespace:'app',issuer,subject:'alice',providerId:'providerA',accountId:'account-alice',linkId:linkId(),status:'active',generation:1,linkedAt:10_000,unlinkedAt:null,...changes});
export const profile = (changes = {}) => ({accountId:'account-alice',sessionId:'session-alice',providerId:'providerA',issuer,subject:'alice',authTime:10_000,methods:['passkey'],expiresAt:20_000,...changes});
export const binding = (changes = {}) => ({namespace:'app',sessionId:'session-alice',accountId:'account-alice',issuer,subject:'alice',providerId:'providerA',linkId:linkId(),generation:1,...changes});

export function memoryDirectoryStore() {
  let rows={identities:new Map(),commands:new Map(),consents:new Map(),revisions:new Map(),events:new Map()};
  let tail=Promise.resolve();
  const controls={falseAt:null,throwAt:null,readAt:null,readValue:null,beforeCommit:null,beforeTransaction:null,outcome:'normal',outcomeScope:'all',foreignValue:null,outcomeGetterCalls:0,transactions:0,reads:[],writes:[],callbackFailures:[]};
  const cloned = source => Object.fromEntries(Object.entries(source).map(([name,map])=>[name,new Map([...map].map(([k,v])=>[k,copy(v)]))]));
  const call = (name, value) => {
    if (controls.throwAt===name) throw Error(`synthetic-${name}-failure`);
    if (controls.falseAt===name) return false;
    if (controls.readAt===name) return controls.readValue;
    return value;
  };
  const txFor = (draft,namespace) => ({
    getIdentity:async (i,s)=>{controls.reads.push('getIdentity');return call('getIdentity',copy(draft.identities.get(key(namespace,i,s))??null));},
    getLink:async id=>{controls.reads.push('getLink');return call('getLink',copy([...draft.identities.values()].find(r=>r.namespace===namespace&&r.linkId===id)??null));},
    listLinks:async (accountId,limit)=>{controls.reads.push('listLinks');return call('listLinks',copy([...draft.identities.values()].filter(r=>r.namespace===namespace&&r.accountId===accountId).slice(0,limit)));},
    getAccountRevision:async id=>{controls.reads.push('getAccountRevision');return call('getAccountRevision',draft.revisions.get(key(namespace,id))??null);},
    getCommand:async id=>{controls.reads.push('getCommand');return call('getCommand',copy(draft.commands.get(key(namespace,id))??null));},
    getConsent:async id=>{controls.reads.push('getConsent');return call('getConsent',copy(draft.consents.get(key(namespace,id))??null));},
    countRows:async ()=>{controls.reads.push('countRows');let count=0;for(const [name,map] of Object.entries(draft))for(const [rowKey,row] of map)if(name==='revisions'?JSON.parse(rowKey)[0]===namespace:row.namespace===namespace)count++;return call('countRows',count);},
    countLinks:async id=>{controls.reads.push('countLinks');return call('countLinks',[...draft.identities.values()].filter(r=>r.namespace===namespace&&r.accountId===id).length);},
    countCommands:async id=>{controls.reads.push('countCommands');return call('countCommands',[...draft.commands.values()].filter(r=>r.namespace===namespace&&r.accountId===id).length);},
    countPendingEvents:async ()=>{controls.reads.push('countPendingEvents');return call('countPendingEvents',[...draft.events.values()].filter(r=>r.namespace===namespace&&r.delivery==='pending').length);},
    insertIdentity:async row=>{controls.writes.push('insertIdentity');if(call('insertIdentity',true)!==true)return false;const k=key(row.namespace,row.issuer,row.subject);if(draft.identities.has(k)||[...draft.identities.values()].some(r=>r.namespace===row.namespace&&r.linkId===row.linkId))return false;draft.identities.set(k,copy(row));return true;},
    updateIdentity:async (expected,row)=>{controls.writes.push('updateIdentity');if(call('updateIdentity',true)!==true)return false;const k=key(row.namespace,row.issuer,row.subject),old=draft.identities.get(k);if(!old||old.generation!==expected||['namespace','issuer','subject','providerId','accountId','linkId','linkedAt'].some(field=>old[field]!==row[field]))return false;draft.identities.set(k,copy(row));return true;},
    insertCommand:async row=>{controls.writes.push('insertCommand');if(call('insertCommand',true)!==true)return false;const k=key(row.namespace,row.commandId);if(draft.commands.has(k))return false;draft.commands.set(k,copy(row));return true;},
    insertConsent:async row=>{controls.writes.push('insertConsent');if(call('insertConsent',true)!==true)return false;const k=key(row.namespace,row.consentId);if(draft.consents.has(k))return false;draft.consents.set(k,copy(row));return true;},
    putAccountRevision:async (id,expected,next)=>{controls.writes.push('putAccountRevision');if(call('putAccountRevision',true)!==true)return false;const k=key(namespace,id),current=draft.revisions.get(k)??null;if(current!==expected)return false;draft.revisions.set(k,next);return true;},
    insertEvent:async row=>{controls.writes.push('insertEvent');if(call('insertEvent',true)!==true)return false;const k=key(row.namespace,row.eventId);if(draft.events.has(k))return false;draft.events.set(k,copy(row));return true;},
    acknowledgeEvent:async id=>{controls.writes.push('acknowledgeEvent');if(call('acknowledgeEvent',true)!==true)return false;const k=key(namespace,id),old=draft.events.get(k);if(!old)return false;draft.events.set(k,{...old,delivery:'acknowledged'});return true;},
  });
  return {
    controls,
    async transaction(namespace,work) {
      const previous=tail;let release;tail=new Promise(resolve=>{release=resolve;});await previous;
      try {
        controls.transactions++;
        if(controls.beforeTransaction)await controls.beforeTransaction();
        const draft=cloned(rows),writesBefore=controls.writes.length;
        let value,callbackFailed=false;
        try { value=await work(txFor(draft,namespace)); }
        catch(error){callbackFailed=true;controls.callbackFailures.push(error);}
        if(controls.beforeCommit)try{await controls.beforeCommit(draft);}catch{return {status:'unknown'};}
        const outcome=controls.outcomeScope==='mutation'&&controls.writes.length===writesBefore?'normal':controls.outcome;
        if(outcome==='reject') {const error=Error('synthetic-unclassified');error.code='storage_unavailable';throw error;}
        if(outcome==='malformed')return {status:'committed',value,extra:true};
        if(outcome==='accessor'){const result={value};Object.defineProperty(result,'status',{enumerable:true,get(){controls.outcomeGetterCalls++;return 'committed';}});return result;}
        if(outcome==='missingValue')return {status:'committed'};
        if(outcome==='foreignValue')return {status:'committed',value:controls.foreignValue};
        if(outcome==='unknown')return {status:'unknown'};
        if(outcome==='confirmed_abort')return {status:'confirmed_abort'};
        if(outcome==='committedAfterCallbackFailure'&&callbackFailed)return {status:'committed',value:controls.foreignValue};
        if(callbackFailed)return {status:'confirmed_abort'};
        rows=draft;
        if(outcome==='committedThenUnknown')return {status:'unknown'};
        return {status:'committed',value};
      }
      finally {release();}
    },
    snapshot:()=>Object.fromEntries(Object.entries(rows).map(([name,map])=>[name,[...map.values()].map(copy)])),
    seedIdentity:row=>rows.identities.set(key(row.namespace,row.issuer,row.subject),copy(row)),
    seedRevision:(namespace,id,revision)=>rows.revisions.set(key(namespace,id),revision),
    seedCommand:row=>rows.commands.set(key(row.namespace,row.commandId),copy(row)),
    seedConsent:row=>rows.consents.set(key(row.namespace,row.consentId),copy(row)),
    seedEvent:row=>rows.events.set(key(row.namespace,row.eventId),copy(row)),
    modelAcknowledge:id=>{for(const [k,row] of rows.events)if(row.eventId===id)rows.events.set(k,{...row,delivery:'acknowledged'});},
    modelCompactExpired:(deadline,now)=>{if(now<deadline)throw Error('fixture compaction before deadline');for(const [k,row] of rows.commands)if(row.expiresAt<=now)rows.commands.delete(k);for(const [k,row] of rows.consents)if(row.expiresAt<=now)rows.consents.delete(k);for(const [k,row] of rows.events)if(row.delivery==='acknowledged'&&row.at<=deadline)rows.events.delete(k);},
  };
}

export function harness(factory,{seedActor=true,options:changes={}}={}) {
  let time=10_000,random=30;
  const reservations=new Map();
  const reservationByCommand=new Map();
  const store=memoryDirectoryStore();
  if(seedActor){store.seedIdentity(identityRow());store.seedRevision('app','account-alice',1);}
  const proofs=new Map([['alice',identity()],['bob',identity('bob')],['charlie',identity('charlie')],['other-issuer',identity('alice',issuerB)]]);
  const sessions=new Map([['alice-session',profile()],['bob-session',profile({accountId:'account-bob',sessionId:'session-bob',subject:'bob'})]]);
  const bindings=new Map([['session-alice',binding()],['session-bob',binding({sessionId:'session-bob',accountId:'account-bob',subject:'bob',linkId:linkId(21)})]]);
  const routes=new Map([[issuer,{providerId:'providerA',revision:'route1'}],[issuerB,{providerId:'providerB',revision:'route2'}]]);
  const providers=new Map([['providerA',{enabled:true,revision:'provider1'}],['providerB',{enabled:true,revision:'provider2'}]]);
  const controls={proofResult:null,proofError:null,sessionResult:null,sessionError:null,bindingResult:null,routeResult:null,providerResult:null,grantResult:null,grantAllowed:true,approvalResult:null,approvalEnabled:true,consentResult:null,consentEnabled:true,quoteResult:null,quoteError:null,reserveResult:null,reserveError:null,settleError:null,onQuote:null,onReserve:null,onAuthorize:null,onVerifyConsent:null,onProof:null,onSession:null};
  const calls={verifyProof:[],canonicalProviderForIssuer:[],authenticateSession:[],sessionBinding:[],providerState:[],authorize:[],provisioningPolicy:[],verifyConsent:[],quote:[],reserve:[],settle:[],release:[],reconcileUnknown:[],random:[]};
  const limits={maxFreshProofAgeMs:1000,maxLinksPerAccount:32,maxCommandReceiptsPerAccount:4096,maxPendingEvents:4096,maxRecordBytes:16384,maxConcurrentCommands:8,replayWindowMs:1000,maxRowsPerNamespace:1000};
  const transitionReservation=(reservationId,commandId,target)=>{
    const record=reservations.get(reservationId);
    if(!record||record.commandId!==commandId)throw Error('synthetic-reservation-binding');
    if(record.state!=='held'&&record.state!==target)throw Error('synthetic-terminal-conflict');
    record.state=target;
  };
  const options={namespace:'app',limits,
    verifyProof:async input=>{calls.verifyProof.push(input);if(controls.onProof)await controls.onProof(input);if(controls.proofError)throw controls.proofError;return controls.proofResult??copy(proofs.get(input.proof)??null);},
    canonicalProviderForIssuer:async value=>{calls.canonicalProviderForIssuer.push(value);return controls.routeResult??copy(routes.get(value)??null);},
    authenticateSession:async input=>{calls.authenticateSession.push(input);if(controls.onSession)await controls.onSession(input);if(controls.sessionError)throw controls.sessionError;return controls.sessionResult??copy(sessions.get(input.token)??null);},
    sessionBinding:async id=>{calls.sessionBinding.push(id);return controls.bindingResult??copy(bindings.get(id)??null);},
    providerState:async id=>{calls.providerState.push(id);return controls.providerResult??copy(providers.get(id)??{enabled:false,revision:'none'});},
    authorize:async input=>{calls.authorize.push(copy(input));if(controls.onAuthorize)await controls.onAuthorize(input);return controls.grantResult??{allowed:controls.grantAllowed,revision:'grant1'};},
    provisioningPolicy:async input=>{calls.provisioningPolicy.push(input);if(!controls.approvalEnabled)return null;const issuedAt=Number(input.commandId.split('.')[0]);return controls.approvalResult??{accountId:'account-alice',approvalId:`approval-${input.commandId.slice(-8)}`,commandId:input.commandId,issuedAt,expiresAt:issuedAt+limits.replayWindowMs};},
    verifyConsent:async input=>{calls.verifyConsent.push(input);if(controls.onVerifyConsent)await controls.onVerifyConsent(input);if(!controls.consentEnabled)return null;const issuedAt=Number(input.commandId.split('.')[0]);return controls.consentResult??{consentId:`consent-${input.commandId.slice(-8)}`,commandId:input.commandId,issuedAt,expiresAt:issuedAt+limits.replayWindowMs};},
    capacity:{
      quoteGrowth:async input=>{calls.quote.push(input);if(controls.onQuote)await controls.onQuote(input);if(controls.quoteError)throw controls.quoteError;return controls.quoteResult??{quoteId:'quote1',upperLogicalBytes:5*limits.maxRecordBytes,admittedLifetimeUntil:input.replayUntil,footprintVersion:'auth-directory.rows.v3'};},
      reserveGrowth:async input=>{calls.reserve.push(input);if(controls.onReserve)await controls.onReserve(input);if(controls.reserveError)throw controls.reserveError;if(controls.reserveResult)return controls.reserveResult;const key=`${input.namespace}\0${input.commandId}`,prior=reservationByCommand.get(key);if(prior){if(prior.intentDigest!==input.intentDigest||prior.accountId!==input.accountId||prior.quoteId!==input.quote?.quoteId||prior.class!==input.class)throw Error('synthetic-reservation-intent-conflict');const state=reservations.get(prior.reservationId)?.state;if(state==='released')throw Error('synthetic-reservation-released');if(state!=='held'&&state!=='settled')throw Error('synthetic-reservation-state');return {reservationId:prior.reservationId};}const reservationId=`reservation-${reservations.size+1}`;reservationByCommand.set(key,{reservationId,intentDigest:input.intentDigest,accountId:input.accountId,quoteId:input.quote?.quoteId,class:input.class});reservations.set(reservationId,{commandId:input.commandId,state:'held'});return {reservationId};},
      settle:async (...args)=>{calls.settle.push(copy(args));if(controls.settleError)throw controls.settleError;transitionReservation(args[0],args[1],'settled');},
      releaseConfirmedAbort:async (...args)=>{calls.release.push(copy(args));transitionReservation(args[0],args[1],'released');},
      reconcileUnknown:async (...args)=>{calls.reconcileUnknown.push(copy(args));if(args[2]!=='committed'&&args[2]!=='confirmed_abort')throw Error('synthetic-reconcile-outcome');transitionReservation(args[0],args[1],args[2]==='committed'?'settled':'released');},
    },
    directoryStore:store,now:()=>time,randomBytes:size=>{calls.random.push(size);return new Uint8Array(size).fill(++random);},
    ...changes,
  };
  const directory=factory(options);
  return {directory,options,store,calls,controls,proofs,sessions,bindings,routes,providers,limits,capacitySnapshot:()=>[...reservations].map(([reservationId,row])=>({reservationId,...row})),setTime:value=>{time=value;},get time(){return time;},
    provision:(id=commandId(),value='charlie')=>directory.provision({proof:proof(value),enrollmentRef:'enrollment-1',commandId:id}),
    link:(id=commandId(),value='bob')=>directory.link({sessionUse:sessionUse(),currentProof:proof('alice'),targetProof:proof(value),consent:'consent-receipt',commandId:id}),
    unlink:(id=commandId(),target=linkId(21))=>directory.unlink({sessionUse:sessionUse(),currentProof:proof('alice'),linkId:target,consent:'consent-receipt',commandId:id}),
    list:()=>directory.list({sessionUse:sessionUse()}),
    guard:()=>directory.assertCurrentLink({sessionUse:sessionUse()}),
    reconcileSession:(id=commandId())=>directory.reconcile({scope:{kind:'session',sessionUse:sessionUse()},commandId:id}),
    reconcileProvision:(id=commandId())=>directory.reconcile({scope:{kind:'provision',proof:proof('charlie'),enrollmentRef:'enrollment-1'},commandId:id}),
  };
}
