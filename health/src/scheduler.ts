import type { CheckDefinition, ProbeResult } from './types.js';

export async function withDeadline<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer!: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('probe deadline exceeded'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export class ProbeScheduler {
  private readonly active = new Set<string>();
  private readonly lastRun = new Map<string, number>();

  constructor(
    private readonly concurrency = 4,
    private readonly jitter = Math.random,
  ) {}

  due(definition: CheckDefinition, now: number): boolean {
    if (definition.enabled === false) return false;
    const last = this.lastRun.get(definition.key);
    const offset = Math.floor(
      definition.intervalSeconds * 1000 * 0.1 * this.jitter(),
    );
    return (
      last === undefined ||
      now - last >= definition.intervalSeconds * 1000 + offset
    );
  }

  async run(
    definition: CheckDefinition,
    probe: (signal: AbortSignal) => Promise<ProbeResult>,
    now = Date.now(),
  ): Promise<ProbeResult> {
    if (
      this.active.size >= this.concurrency ||
      this.active.has(definition.key)
    ) {
      return { status: 'unknown', summary: 'Probe concurrency limit reached' };
    }
    this.active.add(definition.key);
    this.lastRun.set(definition.key, now);
    try {
      return await withDeadline(definition.timeoutMs, probe);
    } catch {
      return {
        status: 'fail',
        summary: 'Probe deadline or execution failure',
        errorClass: 'timeout',
      };
    } finally {
      this.active.delete(definition.key);
    }
  }
}
