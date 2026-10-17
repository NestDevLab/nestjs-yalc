// Design-owned fixtures. Production code must never import this module.
import { createHash } from 'node:crypto';

const clone = value => structuredClone(value);
const key = (...parts) => JSON.stringify(parts);
export const digest = text => createHash('sha256').update(text).digest('hex');
export const origin = 'https://app.example';
export const cookie = (changes = {}) => ({ transport: 'cookie', method: 'POST', origin, secFetchSite: 'same-origin', ...changes });
export const bearer = (changes = {}) => ({ transport: 'bearer', method: 'POST', ...changes });
export const readCookie = (changes = {}) => cookie({ method: 'GET', ...changes });
export const readBearer = (changes = {}) => bearer({ method: 'GET', ...changes });

export function transactionalStore() {
  let state = { sessions: new Map(), tokens: new Map(), events: new Map() };
  let tail = Promise.resolve();
  let unavailable = false;
  let eventUnavailable = false;
  let eventCollision = false;
  let eventsBeforeFailure = null;
  let sessionCollision = false;
  let tokenCollision = false;
  const makeTx = draft => ({
    getToken: async (namespace, hash) => clone(draft.tokens.get(key(namespace, hash)) ?? null),
    getSession: async (namespace, id) => clone(draft.sessions.get(key(namespace, id)) ?? null),
    putToken: async record => { const id = key(record.namespace, record.tokenHash); const old = draft.tokens.get(id); if (!old || old.sessionId !== record.sessionId) throw Error('token update binding invalid'); draft.tokens.set(id, clone(record)); },
    insertToken: async record => { const id = key(record.namespace, record.tokenHash); if (tokenCollision || draft.tokens.has(id)) return false; draft.tokens.set(id, clone(record)); return true; },
    putSession: async record => { const id = key(record.namespace, record.sessionId); if (!draft.sessions.has(id)) throw Error('session update missing'); draft.sessions.set(id, clone(record)); },
    insertSession: async record => { const id = key(record.namespace, record.sessionId); if (sessionCollision || draft.sessions.has(id)) return false; draft.sessions.set(id, clone(record)); return true; },
    putEvent: async event => { if (eventUnavailable || eventsBeforeFailure === 0) throw Error('synthetic-outbox-unavailable'); if (eventsBeforeFailure !== null) eventsBeforeFailure--; const id = key(event.namespace, event.eventId); if (eventCollision || draft.events.has(id)) return false; draft.events.set(id, clone(event)); return true; },
    listSessions: async (namespace, accountId) => [...draft.sessions.values()].filter(r => r.namespace === namespace && r.accountId === accountId).map(clone),
  });
  return {
    async transaction(operation) {
      const previous = tail;
      let release;
      tail = new Promise(resolve => { release = resolve; });
      await previous;
      try {
        if (unavailable) throw Error('synthetic-store-unavailable');
        const draft = { sessions: new Map([...state.sessions].map(([k, v]) => [k, clone(v)])), tokens: new Map([...state.tokens].map(([k, v]) => [k, clone(v)])), events: new Map([...state.events].map(([k, v]) => [k, clone(v)])) };
        const result = await operation(makeTx(draft));
        state = draft;
        return result;
      } finally { release(); }
    },
    snapshot: () => ({ sessions: [...state.sessions.values()].map(clone), tokens: [...state.tokens.values()].map(clone), events: [...state.events.values()].map(clone) }),
    setUnavailable: value => { unavailable = value; },
    setEventUnavailable: value => { eventUnavailable = value; },
    setEventCollision: value => { eventCollision = value; },
    setEventFailureAfter: value => { eventsBeforeFailure = value; },
    setSessionCollision: value => { sessionCollision = value; },
    setTokenCollision: value => { tokenCollision = value; },
  };
}

export function harness(createAuthCore, changes = {}) {
  let time = 10_000;
  let sequence = 0;
  const resolverCalls = [];
  const randomRequests = [];
  const store = transactionalStore();
  const proofs = new Map([
    ['alice-proof', { issuer: 'https://idp.example', subject: 'alice', authTime: time, methods: ['external'] }],
    ['alice-again', { issuer: 'https://idp.example', subject: 'alice', authTime: time, methods: ['external'] }],
    ['bob-proof', { issuer: 'https://idp.example', subject: 'bob', authTime: time, methods: ['external'] }],
  ]);
  const identities = new Map([
    [key('https://idp.example', 'alice'), 'account-alice'],
    [key('https://idp.example', 'bob'), 'account-bob'],
  ]);
  const options = {
    namespace: 'app-one', absoluteTtlMs: 1000, idleTtlMs: 100,
    allowedOrigins: [origin],
    providers: new Map([['external', async proof => clone(proofs.get(proof) ?? null)]]),
    resolveIdentity: async identity => {
      resolverCalls.push(clone(identity));
      const accountId = identities.get(key(identity.issuer, identity.subject));
      return accountId ? { accountId } : null;
    },
    sessions: store,
    now: () => time,
    randomBytes: size => { randomRequests.push(size); return new Uint8Array(size).fill(++sequence); },
    ...changes,
  };
  const core = createAuthCore(options);
  return { core, options, store, proofs, identities, get events() { return store.snapshot().events; }, resolverCalls, randomRequests,
    setTime: value => { time = value; },
    login: (proof = 'alice-proof', context = cookie()) => core.login({ providerId: 'external', proof, context }),
  };
}
