import { EntityManager, IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import {
  AlertOutboxEntity,
  CheckResultEntity,
  CheckStateEntity,
  IncidentEntity,
  SilenceEntity,
} from './entities.js';
import { redactHealthText } from './redact.js';
import { initialCheckState, transitionCheck } from './state-machine.js';
import type {
  CheckDefinition,
  CheckState,
  Notification,
  Notifier,
  ProbeResult,
} from './types.js';

export class OutboxNotifier implements Notifier {
  constructor(private readonly outbox: Repository<AlertOutboxEntity>) {}

  async enqueue(
    notification: Notification,
    manager?: EntityManager,
  ): Promise<void> {
    const outbox = manager?.getRepository(AlertOutboxEntity) ?? this.outbox;
    const existing = await outbox.findOneBy({
      dedupKey: notification.dedupKey,
    });
    if (existing) return;
    await outbox.save(
      outbox.create({
        ...notification,
        text: redactHealthText(notification.text),
        createdAt: new Date(),
        claimedAt: null,
        sentAt: null,
        attempts: 0,
        lastError: null,
      }),
    );
  }
}

export class HealthMonitorService {
  constructor(
    private readonly states: Repository<CheckStateEntity>,
    private readonly results: Repository<CheckResultEntity>,
    private readonly incidents: Repository<IncidentEntity>,
    private readonly silences: Repository<SilenceEntity>,
    private readonly notifier: Notifier,
  ) {}

  async record(
    definition: CheckDefinition,
    result: ProbeResult,
    startedAt: Date,
    durationMs: number,
    parentFailing = false,
    graceUntil?: number,
  ): Promise<CheckState> {
    const now = startedAt.getTime() + durationMs;
    return this.states.manager.transaction(async (manager) => {
      const states = manager.getRepository(CheckStateEntity);
      const results = manager.getRepository(CheckResultEntity);
      const incidents = manager.getRepository(IncidentEntity);
      const previous = await states.findOneBy({ checkKey: definition.key });
      const state: CheckState = previous
        ? {
            status: previous.status as CheckState['status'],
            since: previous.since,
            consecutiveFail: previous.consecutiveFail,
            consecutiveOk: previous.consecutiveOk,
            lastOkAt: previous.lastOkAt ?? undefined,
            transitions: previous.transitions,
            flapping: previous.flapping,
            stableSince: previous.stableSince ?? undefined,
            openIncidentId: previous.openIncidentId ?? undefined,
          }
        : initialCheckState(now);
      const incidentId = `${definition.key}:${now}`;
      const change = transitionCheck({
        state,
        result,
        now,
        failThreshold: definition.failThreshold,
        recoverThreshold: definition.recoverThreshold,
        parentFailing,
        graceUntil,
        incidentId,
      });
      await results.save(
        results.create({
          checkKey: definition.key,
          startedAt,
          durationMs,
          status: result.status,
          summary: redactHealthText(result.summary),
          metrics: result.metrics ?? null,
          errorClass: result.errorClass ?? null,
        }),
      );
      await states.save(
        states.create({
          checkKey: definition.key,
          ...change.state,
          lastOkAt: change.state.lastOkAt ?? null,
          stableSince: change.state.stableSince ?? null,
          openIncidentId: change.state.openIncidentId ?? null,
        }),
      );
      if (change.event === 'open') {
        await incidents.save(
          incidents.create({
            id: incidentId,
            checkKey: definition.key,
            rootKey: definition.key,
            severity: definition.severity,
            openedAt: new Date(now),
            resolvedAt: null,
            firstSummary: redactHealthText(result.summary),
            lastSummary: redactHealthText(result.summary),
            notifyCount: 0,
            lastNotifiedAt: null,
            ackBy: null,
            ackAt: null,
            ackNote: null,
          }),
        );
      }
      if (change.recoveredIncidentId) {
        await incidents.update(change.recoveredIncidentId, {
          resolvedAt: new Date(now),
          lastSummary: redactHealthText(result.summary),
        });
      }
      if (
        change.event &&
        definition.severity === 'critical' &&
        !(await this.isSilenced(definition.key, definition.group, now, manager))
      ) {
        await this.notifier.enqueue(
          {
            dedupKey: `incident:${
              state.openIncidentId ?? change.state.openIncidentId
            }:${change.event}:0`,
            kind: change.event,
            target: 'default',
            text: `${definition.title}: ${redactHealthText(result.summary)}`,
          },
          manager,
        );
      }
      return change.state;
    });
  }

  async isSilenced(
    key: string,
    group: string,
    now: number,
    manager?: EntityManager,
  ): Promise<boolean> {
    const active = await (
      manager?.getRepository(SilenceEntity) ?? this.silences
    ).find({
      where: {
        startsAt: LessThan(new Date(now)),
        endsAt: MoreThan(new Date(now)),
      },
    });
    return active.some(
      (silence) => silence.matcher === key || silence.matcher === `${group}.*`,
    );
  }

  async prune(now = Date.now()): Promise<void> {
    await this.results.delete({
      startedAt: LessThan(new Date(now - 14 * 24 * 60 * 60 * 1000)),
    });
    await this.incidents.delete({
      resolvedAt: LessThan(new Date(now - 90 * 24 * 60 * 60 * 1000)),
    });
    await this.silences.delete({ endsAt: LessThan(new Date(now)) });
  }

  async openIncidents(): Promise<IncidentEntity[]> {
    return this.incidents.findBy({ resolvedAt: IsNull() });
  }
}
