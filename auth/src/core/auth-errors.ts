export type AuthErrorCode =
  | 'invalid_config'
  | 'invalid_input'
  | 'authentication_denied'
  | 'authentication_unavailable'
  | 'session_denied'
  | 'session_expired'
  | 'csrf_denied'
  | 'session_reused'
  | 'storage_unavailable'
  | 'credential_collision';

const codes: ReadonlySet<string> = new Set([
  'invalid_config',
  'invalid_input',
  'authentication_denied',
  'authentication_unavailable',
  'session_denied',
  'session_expired',
  'csrf_denied',
  'session_reused',
  'storage_unavailable',
  'credential_collision',
]);
const coreErrors = new WeakSet<object>();

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode) {
    const safeCode =
      typeof code === 'string' && codes.has(code)
        ? code
        : 'storage_unavailable';
    super(safeCode);
    this.code = safeCode as AuthErrorCode;
    this.name = 'AuthError';
  }
}

export const isCoreError = (value: unknown): value is AuthError =>
  typeof value === 'object' && value !== null && coreErrors.has(value);

export function fail(code: AuthErrorCode): never {
  const error = new AuthError(code);
  coreErrors.add(error);
  throw error;
}
