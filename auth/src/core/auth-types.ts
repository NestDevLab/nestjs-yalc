export type Transport = 'cookie' | 'bearer';

export interface RequestContext {
  transport: Transport;
  method: string;
  origin?: string;
  secFetchSite?: string;
  csrf?: string;
}

export interface VerifiedIdentity {
  issuer: string;
  subject: string;
  authTime: number;
  methods: string[];
}

export interface AuthProfile extends VerifiedIdentity {
  accountId: string;
  sessionId: string;
  providerId: string;
  expiresAt: number;
}

export interface TokenEntry {
  namespace: string;
  tokenHash: string;
  sessionId: string;
  state: 'current' | 'rotated';
}

export interface SessionRecord extends AuthProfile {
  namespace: string;
  transport: Transport;
  createdAt: number;
  lastSeenAt: number;
  csrfHash: string | null;
  revokedAt: number | null;
  revision: number;
}

export interface SessionEvent {
  eventId: string;
  namespace: string;
  kind:
    | 'session_created'
    | 'session_refreshed'
    | 'session_revoked'
    | 'session_reused';
  at: number;
  sessionId: string;
  revision: number;
  reason: string;
}

export interface SessionTransaction {
  getToken(namespace: string, tokenHash: string): Promise<TokenEntry | null>;
  getSession(
    namespace: string,
    sessionId: string,
  ): Promise<SessionRecord | null>;
  putToken(entry: TokenEntry): Promise<void>;
  putSession(record: SessionRecord): Promise<void>;
  insertSession(record: SessionRecord): Promise<boolean>;
  insertToken(entry: TokenEntry): Promise<boolean>;
  putEvent(event: SessionEvent): Promise<boolean>;
  listSessions(namespace: string, accountId: string): Promise<SessionRecord[]>;
}

export interface SessionStore {
  transaction<T>(work: (tx: SessionTransaction) => Promise<T>): Promise<T>;
}

export interface AuthCoreOptions {
  namespace: string;
  absoluteTtlMs: number;
  idleTtlMs: number;
  allowedOrigins: string[];
  providers: Map<string, (proof: unknown) => Promise<unknown>>;
  resolveIdentity(identity: VerifiedIdentity): Promise<unknown>;
  sessions: SessionStore;
  now(): number;
  randomBytes(size: number): Uint8Array;
}

export interface IssuedSession {
  token: string;
  csrfToken?: string;
  profile: AuthProfile;
}

export interface AuthCore {
  login(input: {
    providerId: string;
    proof: unknown;
    context: RequestContext;
  }): Promise<IssuedSession>;
  authenticate(input: {
    token: string;
    context: RequestContext;
  }): Promise<AuthProfile>;
  refresh(input: {
    token: string;
    context: RequestContext;
  }): Promise<IssuedSession>;
  logout(input: {
    token: string;
    context: RequestContext;
  }): Promise<{ revoked: boolean }>;
  revokeAll(accountId: string): Promise<{ revoked: number }>;
}
