/** Exact verified identity; provider routing is independently host configured. */
export interface Identity {
  issuer: string;
  subject: string;
  authTime: number;
  methods: readonly string[];
}
export interface ProofInput {
  providerId: string;
  proof: string | Uint8Array;
}
export interface SessionUse {
  token: string;
  context: unknown;
}
export interface SessionProfile extends Identity {
  accountId: string;
  sessionId: string;
  providerId: string;
  expiresAt: number;
}
export interface SessionBinding {
  namespace: string;
  sessionId: string;
  accountId: string;
  issuer: string;
  subject: string;
  providerId: string;
  linkId: string;
  generation: number;
}
export interface GuardResult {
  accountId: string;
  linkId: string;
  generation: number;
  accountRevision: number;
}
export interface CommandResult {
  status: 'provisioned' | 'linked' | 'unlinked';
  accountId: string;
  linkId: string;
  revision: number;
  replay: boolean;
}
export interface LinkView {
  linkId: string;
  providerId: string;
  issuer: string;
  usable: boolean;
  linkedAt: number;
}
export interface IdentityRow {
  namespace: string;
  issuer: string;
  subject: string;
  providerId: string;
  accountId: string;
  linkId: string;
  status: 'active' | 'unlinked';
  generation: number;
  linkedAt: number;
  unlinkedAt: number | null;
}
export interface CommandRow {
  namespace: string;
  commandId: string;
  accountId: string;
  action: 'provision' | 'link' | 'unlink';
  intentDigest: string;
  result: CommandResult;
  reservationId: string;
  eventId: string;
  expiresAt: number;
}
export interface ConsentRow {
  namespace: string;
  consentId: string;
  commandId: string;
  expiresAt: number;
}
export interface EventRow {
  eventId: string;
  namespace: string;
  kind: 'identity_provisioned' | 'identity_linked' | 'identity_unlinked';
  accountId: string;
  linkId: string;
  providerId: string;
  revision: number;
  at: number;
  commandId: string;
  delivery: 'pending' | 'acknowledged';
}
export interface DirectoryTx {
  getIdentity(issuer: string, subject: string): Promise<IdentityRow | null>;
  getLink(linkId: string): Promise<IdentityRow | null>;
  listLinks(accountId: string, limit: number): Promise<IdentityRow[]>;
  getAccountRevision(accountId: string): Promise<number | null>;
  getCommand(commandId: string): Promise<CommandRow | null>;
  getConsent(consentId: string): Promise<ConsentRow | null>;
  countRows(): Promise<number>;
  countLinks(accountId: string): Promise<number>;
  countCommands(accountId: string): Promise<number>;
  countPendingEvents(): Promise<number>;
  insertIdentity(row: IdentityRow): Promise<boolean>;
  updateIdentity(
    expectedGeneration: number,
    row: IdentityRow,
  ): Promise<boolean>;
  insertCommand(row: CommandRow): Promise<boolean>;
  insertConsent(row: ConsentRow): Promise<boolean>;
  putAccountRevision(
    accountId: string,
    expected: number | null,
    next: number,
  ): Promise<boolean>;
  insertEvent(row: EventRow): Promise<boolean>;
  acknowledgeEvent(eventId: string): Promise<boolean>;
}
export type TransactionOutcome<T> =
  | { status: 'committed'; value: T }
  | { status: 'confirmed_abort' }
  | { status: 'unknown' };
export interface DirectoryStore {
  transaction<T>(
    namespace: string,
    work: (tx: DirectoryTx) => Promise<T>,
  ): Promise<TransactionOutcome<T>>;
}
export interface DirectoryLimits {
  maxFreshProofAgeMs: number;
  maxLinksPerAccount: number;
  maxCommandReceiptsPerAccount: number;
  maxPendingEvents: number;
  maxRecordBytes: number;
  maxConcurrentCommands: number;
  replayWindowMs: number;
  maxRowsPerNamespace: number;
}
export interface Quote {
  quoteId: string;
  upperLogicalBytes: number;
  admittedLifetimeUntil: number;
  footprintVersion: string;
}
export interface DirectoryOptions {
  namespace: string;
  limits: DirectoryLimits;
  verifyProof(input: ProofInput): Promise<Identity | null>;
  canonicalProviderForIssuer(
    issuer: string,
  ): Promise<{ providerId: string; revision: string } | null>;
  authenticateSession(input: SessionUse): Promise<SessionProfile>;
  sessionBinding(sessionId: string): Promise<SessionBinding | null>;
  providerState(
    providerId: string,
  ): Promise<{ enabled: boolean; revision: string }>;
  authorize(input: {
    action: 'link' | 'unlink' | 'list' | 'reconcile' | 'guard';
    namespace: string;
    accountId: string;
    sessionId: string;
  }): Promise<{ allowed: boolean; revision: string }>;
  provisioningPolicy(input: {
    namespace: string;
    enrollmentRef: string;
    verifiedIdentity: Identity;
    commandId: string;
  }): Promise<{
    accountId: string;
    approvalId: string;
    commandId: string;
    issuedAt: number;
    expiresAt: number;
  } | null>;
  verifyConsent(input: {
    receipt: string;
    action: 'link' | 'unlink';
    accountId: string;
    commandId: string;
    target: {
      providerId: string;
      issuer?: string;
      subject?: string;
      linkId?: string;
    };
  }): Promise<{
    consentId: string;
    commandId: string;
    issuedAt: number;
    expiresAt: number;
  } | null>;
  capacity: {
    quoteGrowth(input: {
      namespace: string;
      accountId: string;
      commandId: string;
      intentDigest: string;
      logicalFootprint: readonly {
        kind: 'identity' | 'accountRevision' | 'command' | 'consent' | 'event';
        upperBytes: number;
      }[];
      replayUntil: number;
      class: 'auth-core';
    }): Promise<Quote>;
    reserveGrowth(input: {
      namespace: string;
      accountId: string;
      commandId: string;
      intentDigest: string;
      quote: Quote;
      class: 'auth-core';
    }): Promise<{ reservationId: string }>;
    settle(reservationId: string, commandId: string): Promise<void>;
    releaseConfirmedAbort(
      reservationId: string,
      commandId: string,
    ): Promise<void>;
    reconcileUnknown(
      reservationId: string,
      commandId: string,
      outcome: 'committed' | 'confirmed_abort',
    ): Promise<void>;
  };
  directoryStore: DirectoryStore;
  now(): number;
  randomBytes(size: 32): Uint8Array;
}
export type ReconcileScope =
  | { kind: 'session'; sessionUse: SessionUse }
  | { kind: 'provision'; proof: ProofInput; enrollmentRef: string };
export interface IdentityDirectory {
  resolveIdentity(identity: Identity): Promise<{ accountId: string } | null>;
  provision(input: {
    proof: ProofInput;
    enrollmentRef: string;
    commandId: string;
  }): Promise<CommandResult>;
  link(input: {
    sessionUse: SessionUse;
    currentProof: ProofInput;
    targetProof: ProofInput;
    consent: string;
    commandId: string;
  }): Promise<CommandResult>;
  unlink(input: {
    sessionUse: SessionUse;
    currentProof: ProofInput;
    linkId: string;
    consent: string;
    commandId: string;
  }): Promise<CommandResult>;
  list(input: {
    sessionUse: SessionUse;
  }): Promise<{ revision: number; links: LinkView[] }>;
  reconcile(input: {
    scope: ReconcileScope;
    commandId: string;
  }): Promise<CommandResult | null>;
  assertCurrentLink(input: { sessionUse: SessionUse }): Promise<GuardResult>;
}
