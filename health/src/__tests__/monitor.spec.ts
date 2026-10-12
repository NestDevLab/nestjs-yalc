import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { DataSource } from "typeorm";
import {
  AlertOutboxEntity,
  CheckResultEntity,
  CheckStateEntity,
  IncidentEntity,
  SilenceEntity,
  healthEntities,
} from "../entities.js";
import { HealthMonitorService, OutboxNotifier } from "../monitor.js";
import type { CheckDefinition } from "../types.js";

const definition: CheckDefinition = {
  key: "service.example",
  group: "service",
  title: "Example service",
  kind: "http",
  target: {},
  intervalSeconds: 60,
  timeoutMs: 100,
  severity: "critical",
};
let source: DataSource;
let monitor: HealthMonitorService;
let notifier: OutboxNotifier;

beforeEach(async () => {
  source = new DataSource({
    type: "sqlite",
    database: ":memory:",
    entities: healthEntities,
    synchronize: true,
  });
  await source.initialize();
  notifier = new OutboxNotifier(source.getRepository(AlertOutboxEntity));
  monitor = new HealthMonitorService(
    source.getRepository(CheckStateEntity),
    source.getRepository(CheckResultEntity),
    source.getRepository(IncidentEntity),
    source.getRepository(SilenceEntity),
    notifier
  );
});

afterEach(async () => {
  await source.destroy();
});

describe("persistent health monitor", () => {
  it("persists one incident, redacts, deduplicates outbox, and resolves", async () => {
    const base = 1_700_000_000_000;
    await monitor.record(
      definition,
      { status: "fail", summary: "Bearer synthetic-token" },
      new Date(base),
      0
    );
    const opened = await monitor.record(
      definition,
      { status: "fail", summary: "Bearer synthetic-token" },
      new Date(base + 1000),
      0
    );
    expect(opened.openIncidentId).toBeDefined();
    expect(await monitor.openIncidents()).toHaveLength(1);
    expect(
      (await source.getRepository(CheckResultEntity).find())[1].summary
    ).not.toContain("synthetic-token");
    const rows = await source.getRepository(AlertOutboxEntity).find();
    expect(rows).toHaveLength(1);
    expect(rows[0].text).not.toContain("synthetic-token");
    await notifier.enqueue({
      dedupKey: rows[0].dedupKey,
      kind: "open",
      target: "default",
      text: "duplicate",
    });
    expect(await source.getRepository(AlertOutboxEntity).count()).toBe(1);
    await monitor.record(
      definition,
      { status: "ok", summary: "healthy" },
      new Date(base + 2000),
      0
    );
    await monitor.record(
      definition,
      { status: "ok", summary: "healthy" },
      new Date(base + 3000),
      0
    );
    expect(await monitor.openIncidents()).toHaveLength(0);
    expect(await source.getRepository(AlertOutboxEntity).count()).toBe(2);
  });

  it("suppresses an active silence and prunes expired rows", async () => {
    const now = Date.now();
    await source.getRepository(SilenceEntity).save({
      matcher: "service.*",
      startsAt: new Date(now - 1000),
      endsAt: new Date(now + 100000),
      reason: "maintenance",
      createdBy: "operator",
    });
    expect(
      await monitor.isSilenced(definition.key, definition.group, now)
    ).toBe(true);
    await monitor.record(
      definition,
      { status: "fail", summary: "unavailable" },
      new Date(now),
      0
    );
    await monitor.record(
      definition,
      { status: "fail", summary: "unavailable" },
      new Date(now + 1000),
      0
    );
    expect(await source.getRepository(AlertOutboxEntity).count()).toBe(0);
    await monitor.prune(now + 100 * 24 * 60 * 60 * 1000);
    expect(await source.getRepository(CheckResultEntity).count()).toBe(0);
    expect(await source.getRepository(SilenceEntity).count()).toBe(0);
  });

  it("uses the current time when pruning without an argument", async () => {
    await monitor.prune();
  });

  it("resolves the incident on a flapping recovery and clears flapping after a database reload", async () => {
    const rapid = { ...definition, failThreshold: 1, recoverThreshold: 1 };
    const base = 1_700_000_000_000;
    for (const [index, status] of ["fail", "ok", "fail", "ok"].entries()) {
      await monitor.record(
        rapid,
        { status: status as "fail" | "ok", summary: status },
        new Date(base + index),
        0
      );
    }
    expect(await monitor.openIncidents()).toHaveLength(0);
    const persisted = await source
      .getRepository(CheckStateEntity)
      .findOneByOrFail({ checkKey: rapid.key });
    expect(persisted.flapping).toBe(true);
    expect(persisted.stableSince).toBe(base + 3);
    const reloaded = new HealthMonitorService(
      source.getRepository(CheckStateEntity),
      source.getRepository(CheckResultEntity),
      source.getRepository(IncidentEntity),
      source.getRepository(SilenceEntity),
      notifier
    );
    const stable = await reloaded.record(
      rapid,
      { status: "ok", summary: "stable" },
      new Date(base + 30 * 60 * 1000 + 4),
      0
    );
    expect(stable.flapping).toBe(false);
    expect(
      (
        await source
          .getRepository(CheckStateEntity)
          .findOneByOrFail({ checkKey: rapid.key })
      ).flapping
    ).toBe(false);
  });

  it("rolls back state, incident, result, and outbox when enqueue fails", async () => {
    const broken = new HealthMonitorService(
      source.getRepository(CheckStateEntity),
      source.getRepository(CheckResultEntity),
      source.getRepository(IncidentEntity),
      source.getRepository(SilenceEntity),
      {
        enqueue: async () => {
          throw new Error("injected outbox failure");
        },
      }
    );
    await expect(
      broken.record(
        { ...definition, failThreshold: 1 },
        { status: "fail", summary: "down" },
        new Date(),
        0
      )
    ).rejects.toThrow("injected outbox failure");
    expect(await source.getRepository(CheckStateEntity).count()).toBe(0);
    expect(await source.getRepository(CheckResultEntity).count()).toBe(0);
    expect(await source.getRepository(IncidentEntity).count()).toBe(0);
    expect(await source.getRepository(AlertOutboxEntity).count()).toBe(0);
  });
});
