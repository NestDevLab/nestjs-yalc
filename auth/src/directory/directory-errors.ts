export type DirectoryErrorCode =
  | 'invalid_config'
  | 'invalid_input'
  | 'authentication_denied'
  | 'authentication_unavailable'
  | 'authorization_denied'
  | 'provider_disabled'
  | 'consent_denied'
  | 'identity_conflict'
  | 'command_conflict'
  | 'command_expired'
  | 'last_method'
  | 'capacity_exceeded'
  | 'storage_unavailable'
  | 'commit_unknown';
const codes: ReadonlySet<string> = new Set([
  'invalid_config',
  'invalid_input',
  'authentication_denied',
  'authentication_unavailable',
  'authorization_denied',
  'provider_disabled',
  'consent_denied',
  'identity_conflict',
  'command_conflict',
  'command_expired',
  'last_method',
  'capacity_exceeded',
  'storage_unavailable',
  'commit_unknown',
]);
const localErrors = new WeakSet<object>();
export class DirectoryError extends Error {
  readonly code: DirectoryErrorCode;
  constructor(code: DirectoryErrorCode) {
    const safe =
      typeof code === 'string' && codes.has(code)
        ? code
        : 'storage_unavailable';
    super(safe);
    this.name = 'DirectoryError';
    this.code = safe as DirectoryErrorCode;
  }
}
export const isDirectoryError = (value: unknown): value is DirectoryError =>
  typeof value === 'object' && value !== null && localErrors.has(value);
export function fail(code: DirectoryErrorCode): never {
  const error = new DirectoryError(code);
  localErrors.add(error);
  throw error;
}
