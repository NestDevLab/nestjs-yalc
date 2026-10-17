// Labeled missing-behavior baseline. It makes no directory decisions or writes.
export function createIdentityDirectory() {
  const missing = async () => { const error = new Error('auth directory is not implemented'); error.code = 'unimplemented'; throw error; };
  return {
    resolveIdentity:missing, provision:missing, link:missing, unlink:missing,
    list:missing, reconcile:missing, assertCurrentLink:missing,
  };
}
