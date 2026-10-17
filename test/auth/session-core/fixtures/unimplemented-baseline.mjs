// Deliberately unimplemented design baseline, never production code or a reference realization.
const missing = () => { throw Object.assign(Error('No auth-session implementation exists in this baseline'), { code: 'unimplemented' }); };
export function createAuthCore() {
  return { login: missing, authenticate: missing, refresh: missing, logout: missing, revokeAll: missing };
}
