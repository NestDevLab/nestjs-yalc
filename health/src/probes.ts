import { connect } from 'node:net';
import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import sqlite3 from 'sqlite3';
import type { CheckDefinition, ProbeResult } from './types.js';
import { redactHealthText } from './redact.js';
import { withDeadline } from './scheduler.js';

type Target = Record<string, unknown>;

function field(target: Target, key: string): string {
  const value = target[key];
  if (typeof value !== 'string' || !value) throw new Error(`Missing ${key}`);
  return value;
}

function finiteNumber(target: Target, key: string, fallback: number): number {
  const value = target[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function failure(error: unknown): ProbeResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    status: 'fail',
    summary: redactHealthText(message),
    errorClass: 'missing',
  };
}

export async function httpProbe(
  target: Target,
  signal: AbortSignal,
): Promise<ProbeResult> {
  const response = await fetch(field(target, 'url'), {
    method: 'GET',
    signal,
    redirect: 'manual',
  });
  const expected = finiteNumber(target, 'status', 200);
  return response.status === expected
    ? { status: 'ok', summary: `HTTP ${response.status}` }
    : {
        status: 'fail',
        summary: `HTTP ${response.status}`,
        errorClass: response.status >= 500 ? 'http5xx' : 'protocol',
      };
}

export async function tcpProbe(
  target: Target,
  signal: AbortSignal,
): Promise<ProbeResult> {
  const host = field(target, 'host');
  const port = finiteNumber(target, 'port', 0);
  if (port < 1 || port > 65535) throw new Error('Invalid port');
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const finish = (result: ProbeResult): void => {
      socket.destroy();
      resolve(result);
    };
    socket.once('connect', () =>
      finish({ status: 'ok', summary: 'TCP connected' }),
    );
    socket.once('error', (error) => finish(failure(error)));
    signal.addEventListener(
      'abort',
      () =>
        finish({
          status: 'fail',
          summary: 'TCP deadline exceeded',
          errorClass: 'timeout',
        }),
      { once: true },
    );
  });
}

export async function fileProbe(target: Target): Promise<ProbeResult> {
  const path = field(target, 'path');
  const link = await lstat(path);
  const resolved = await realpath(path);
  const details = await stat(resolved);
  const maxAgeMs = finiteNumber(target, 'maxAgeMs', Infinity);
  const age = Date.now() - details.mtimeMs;
  const mode = details.mode & 0o777;
  const expectedMode = finiteNumber(target, 'mode', -1);
  if (expectedMode >= 0 && mode !== expectedMode) {
    return {
      status: 'fail',
      summary: 'File mode mismatch',
      errorClass: 'protocol',
      metrics: { mode },
    };
  }
  if (age > maxAgeMs) {
    return {
      status: 'fail',
      summary: 'File is stale',
      errorClass: 'stale',
      metrics: { ageMs: age },
    };
  }
  return {
    status: 'ok',
    summary: link.isSymbolicLink() ? 'Symlink target present' : 'File present',
    metrics: { ageMs: age },
  };
}

export async function heartbeatFileProbe(target: Target): Promise<ProbeResult> {
  const result = await fileProbe(target);
  if (result.status !== 'ok') return result;
  const content = await readFile(field(target, 'path'), 'utf8');
  const heartbeat = JSON.parse(content) as {
    lastSuccessAt?: string;
    status?: string;
  };
  const last = Date.parse(heartbeat.lastSuccessAt ?? '');
  const age = Date.now() - last;
  if (
    heartbeat.status !== 'ok' ||
    !Number.isFinite(last) ||
    age > finiteNumber(target, 'maxAgeMs', Infinity)
  ) {
    return {
      status: 'fail',
      summary: 'Heartbeat is stale or unsuccessful',
      errorClass: 'stale',
      metrics: { ageMs: age },
    };
  }
  return {
    status: 'ok',
    summary: 'Heartbeat current',
    metrics: { ageMs: age },
  };
}

export async function sqliteReadonlyProbe(
  target: Target,
  signal: AbortSignal,
): Promise<ProbeResult> {
  const path = field(target, 'path');
  const query = field(target, 'query');
  if (
    !/^\s*select\b/i.test(query) ||
    /;|\b(?:attach|pragma|insert|update|delete|replace|create|drop|alter)\b/i.test(
      query,
    )
  ) {
    throw new Error('Only one SELECT statement is permitted');
  }
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(
      path,
      sqlite3.OPEN_READONLY,
      (openError) => {
        if (openError) {
          database.close();
          reject(openError);
          return;
        }
        database.get(
          query,
          [],
          (queryError, row: Record<string, unknown> | undefined) => {
            database.close();
            if (queryError) reject(queryError);
            else if (!row)
              resolve({ status: 'unknown', summary: 'Query returned no rows' });
            else
              resolve({
                status: 'ok',
                summary: 'Read-only query succeeded',
                metrics: { rows: 1 },
              });
          },
        );
      },
    );
    signal.addEventListener(
      'abort',
      () => {
        database.interrupt();
        reject(new Error('SQLite deadline exceeded'));
      },
      { once: true },
    );
  });
}

type RpcResponse = {
  jsonrpc?: string;
  id?: number;
  result?: { tools?: { name: string }[] };
  error?: unknown;
};

async function rpc(
  url: string,
  session: string | undefined,
  id: number,
  method: string,
  params: object,
  signal: AbortSignal,
): Promise<{ response: Response; body?: RpcResponse }> {
  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(session ? { 'mcp-session-id': session } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  if (response.status === 202) return { response };
  const text = await response.text();
  const payload = response.headers
    .get('content-type')
    ?.includes('text/event-stream')
    ? text
        .split('\n')
        .find((line) => line.startsWith('data:'))
        ?.slice(5)
        .trim()
    : text;
  return {
    response,
    body: payload ? (JSON.parse(payload) as RpcResponse) : undefined,
  };
}

export async function mcpProbe(
  target: Target,
  signal: AbortSignal,
): Promise<ProbeResult> {
  const url = field(target, 'url');
  const initialized = await rpc(
    url,
    undefined,
    1,
    'initialize',
    {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'health-probe', version: '1' },
    },
    signal,
  );
  if (
    initialized.response.status !== 200 ||
    initialized.body?.error ||
    !initialized.body?.result
  ) {
    return {
      status: 'warn',
      summary: `MCP initialize protocol defect (${initialized.response.status})`,
      errorClass: 'protocol',
    };
  }
  const session =
    initialized.response.headers.get('mcp-session-id') ?? undefined;
  await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      ...(session ? { 'mcp-session-id': session } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }),
  });
  const listed = await rpc(url, session, 2, 'tools/list', {}, signal);
  if (listed.response.status === 202 || !listed.body?.result?.tools) {
    return {
      status: 'warn',
      summary: 'MCP tools/list protocol defect',
      errorClass: 'protocol',
    };
  }
  const names = listed.body.result.tools.map((tool) => tool.name);
  const required = Array.isArray(target.requiredTools)
    ? (target.requiredTools as string[])
    : [];
  const min = finiteNumber(target, 'minTools', 1);
  if (names.length < min || required.some((name) => !names.includes(name))) {
    return {
      status: 'fail',
      summary: 'MCP tool inventory mismatch',
      errorClass: 'missing',
      metrics: { toolCount: names.length },
    };
  }
  if (typeof target.safeTool === 'string') {
    const called = await rpc(
      url,
      session,
      3,
      'tools/call',
      { name: target.safeTool, arguments: {} },
      signal,
    );
    if (called.response.status === 202 || !called.body?.result) {
      return {
        status: 'warn',
        summary: 'MCP tools/call protocol defect',
        errorClass: 'protocol',
        metrics: { toolCount: names.length },
      };
    }
  }
  return {
    status: 'ok',
    summary: 'MCP tools available',
    metrics: { toolCount: names.length },
  };
}

export async function runGenericProbe(
  definition: CheckDefinition,
): Promise<ProbeResult> {
  try {
    return await withDeadline(definition.timeoutMs, async (signal) => {
      switch (definition.kind) {
        case 'http':
          return httpProbe(definition.target, signal);
        case 'mcp-streamable-http':
          return mcpProbe(definition.target, signal);
        case 'tcp':
          return tcpProbe(definition.target, signal);
        case 'file':
          return fileProbe(definition.target);
        case 'heartbeat-file':
          return heartbeatFileProbe(definition.target);
        case 'sqlite-readonly-query':
          return sqliteReadonlyProbe(definition.target, signal);
        default:
          return {
            status: 'unknown',
            summary: 'Probe kind requires an application adapter',
          };
      }
    });
  } catch (error) {
    const result = failure(error);
    if (error instanceof Error && error.message.includes('deadline'))
      result.errorClass = 'timeout';
    return result;
  }
}
