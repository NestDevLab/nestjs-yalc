export type CheckStatus =
  | 'ok'
  | 'warn'
  | 'fail'
  | 'unknown'
  | 'blocked'
  | 'disabled';
export type IncidentEvent = 'open' | 'recover' | 'flapping' | null;
export type ProbeKind =
  | 'http'
  | 'mcp-streamable-http'
  | 'tcp'
  | 'file'
  | 'heartbeat-file'
  | 'sqlite-readonly-query'
  | 'service-report';

export interface CheckDefinition {
  key: string;
  group: string;
  title: string;
  kind: ProbeKind | string;
  target: Record<string, unknown>;
  intervalSeconds: number;
  timeoutMs: number;
  severity: 'critical' | 'warning' | 'info';
  failThreshold?: number;
  recoverThreshold?: number;
  dependsOn?: string[];
  enabled?: boolean;
  disabledReason?: string;
}

export interface ProbeResult {
  status: CheckStatus;
  summary: string;
  errorClass?:
    | 'timeout'
    | 'auth'
    | 'dns'
    | 'http5xx'
    | 'protocol'
    | 'stale'
    | 'missing';
  metrics?: Record<string, number>;
}

export interface CheckState {
  status: CheckStatus;
  since: number;
  consecutiveFail: number;
  consecutiveOk: number;
  lastOkAt?: number;
  transitions: number[];
  flapping: boolean;
  stableSince?: number;
  openIncidentId?: string;
}

export interface TransitionInput {
  state: CheckState;
  result: ProbeResult;
  now: number;
  failThreshold?: number;
  recoverThreshold?: number;
  parentFailing?: boolean;
  graceUntil?: number;
  incidentId?: string;
}

export interface TransitionOutput {
  state: CheckState;
  event: IncidentEvent;
}

export interface Probe {
  run(definition: CheckDefinition, signal: AbortSignal): Promise<ProbeResult>;
}

export interface Notification {
  dedupKey: string;
  kind: 'open' | 'recover' | 'flapping' | 'reminder' | 'digest' | 'meta';
  text: string;
  target: string;
}

export interface Notifier {
  enqueue(notification: Notification): Promise<void>;
}
