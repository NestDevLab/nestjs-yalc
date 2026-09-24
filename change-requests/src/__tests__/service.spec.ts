import "reflect-metadata";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { DataSource } from "typeorm";
import type { YalcEventService } from "@nestjs-yalc/event-manager";
import { ChangeRequestEntity, ChangeRequestItemEntity } from "../entities.js";
import {
  CHANGE_REQUEST_ADAPTERS,
  ChangeRequestAdapterRegistry,
} from "../registry.js";
import { ChangeRequestService } from "../service.js";
import type {
  ChangeRequestActor,
  ChangeRequestAdapter,
  CreateChangeRequest,
} from "../types.js";
import { CreateChangeRequests1727164800000 } from "../migration.js";
import { ChangeRequestModule } from '../module.js';

const actor: ChangeRequestActor = {
  kind: "human",
  id: "editor",
  label: "Editor",
};
const input = (items: CreateChangeRequest["items"]): CreateChangeRequest => ({
  entityType: "article",
  target: "headline",
  entityId: "a1",
  proposer: actor,
  items,
});

describe("change requests", () => {
  let db: DataSource;
  let service: ChangeRequestService;
  let registry: ChangeRequestAdapterRegistry;
  const live = new Map<string, unknown>();
  const events = {
    emitAsync: jest.fn(async () => undefined),
    errorBadRequest: (name: string) => new Error(name),
    errorNotFound: (name: string) => new Error(name),
  } as unknown as YalcEventService;
  let failApply = false;
  const key = (fieldKey: string, variant = "") => `${fieldKey}:${variant}`;
  const adapter: ChangeRequestAdapter = {
    entityType: "article",
    target: "headline",
    describe: async (entityId) => ({ label: entityId }),
    read: async (_entityId, items) =>
      items.map((item) => ({
        fieldKey: item.fieldKey,
        variant: item.variant ?? "",
        value: live.get(key(item.fieldKey, item.variant)) ?? null,
      })),
    validate: async () => undefined,
    apply: async (_entityId, items) => {
      if (failApply) throw new Error("private adapter failure");
      for (const item of items)
        live.set(key(item.fieldKey, item.variant), item.value);
    },
  };

  beforeAll(async () => {
    db = new DataSource({
      type: "sqlite",
      database: ":memory:",
      entities: [ChangeRequestEntity, ChangeRequestItemEntity],
      synchronize: false,
    });
    await db.initialize();
    await new CreateChangeRequests1727164800000().up(db.createQueryRunner());
    registry = new ChangeRequestAdapterRegistry([adapter], events);
    service = new ChangeRequestService(
      db.getRepository(ChangeRequestEntity),
      db.getRepository(ChangeRequestItemEntity),
      registry,
      events,
    );
  });
  afterAll(async () => {
    await db.destroy();
  });
  beforeEach(async () => {
    await db.getRepository(ChangeRequestItemEntity).clear();
    await db.getRepository(ChangeRequestEntity).clear();
    live.clear();
    failApply = false;
    jest.mocked(events.emitAsync).mockClear();
  });

  it("creates, describes, filters and replaces an open field", async () => {
    const first = await service.create(
      input([{ fieldKey: "name", proposedValue: "First" }]),
    );
    expect(first.items[0].variant).toBe("");
    const detail = await service.get(first.id);
    expect(detail.items[0].liveValue).toBeNull();
    expect(detail.description).toEqual({ label: "a1" });
    const second = await service.create(
      input([{ fieldKey: "name", proposedValue: "Second" }]),
    );
    expect(await db.getRepository(ChangeRequestEntity).count()).toBe(1);
    expect(
      (
        await service.list({
          entityType: "article",
          target: "headline",
          state: "proposed",
        })
      ).openItemCount,
    ).toBe(1);
    expect((await service.list({ entityId: "other" })).total).toBe(0);
    expect((await service.list({ offset: 1, limit: 1 })).requests).toEqual([]);
    expect(second.items[0].proposedValue).toBe("Second");
  });

  it("approves one variant and resolves a repeat without writing", async () => {
    const request = await service.create(
      input([
        { fieldKey: "name", variant: "en", proposedValue: "Hello" },
        { fieldKey: "name", variant: "nl", proposedValue: "Hallo" },
      ]),
    );
    const en = request.items.find((item) => item.variant === "en")!;
    expect(await service.approve(request.id, [en.id], actor)).toEqual([
      { itemId: en.id, status: "published" },
    ]);
    expect(live.get("name:en")).toBe("Hello");
    expect((await service.get(request.id)).request.items).toHaveLength(1);
    expect(await service.approve(request.id, [en.id], actor)).toEqual([
      { itemId: en.id, status: "alreadyResolved" },
    ]);
    expect(await service.approve(request.id, "all", actor)).toHaveLength(1);
    expect(await db.getRepository(ChangeRequestEntity).count()).toBe(0);
    expect(await service.approve(request.id, [en.id], actor)).toEqual([
      { itemId: en.id, status: "alreadyResolved" },
    ]);
  });

  it("treats a live proposed value as published without adapter apply", async () => {
    const request = await service.create(
      input([{ fieldKey: "name", proposedValue: "Done" }]),
    );
    live.set("name:", "Done");
    failApply = true;
    expect(await service.approve(request.id, "all", actor)).toEqual([
      { itemId: request.items[0].id, status: "published" },
    ]);
  });

  it("marks a changed base stale and refreshes it", async () => {
    const request = await service.create(
      input([{ fieldKey: "name", proposedValue: "New" }]),
    );
    live.set("name:", "Outside");
    expect((await service.approve(request.id, "all", actor))[0].status).toBe(
      "stale",
    );
    expect((await service.update(request.id, [{ itemId: request.items[0].id, proposedValue: 'Newer' }], actor)).items[0].state).toBe('stale');
    const refreshed = await service.refresh(
      request.id,
      [request.items[0].id],
      actor,
    );
    expect(refreshed.items[0].baseValue).toBe("Outside");
    expect(refreshed.items[0].state).toBe("proposed");
    expect((await service.approve(request.id, "all", actor))[0].status).toBe(
      "published",
    );
  });

  it("keeps a failed publication and retries safely", async () => {
    const request = await service.create(
      input([{ fieldKey: "name", proposedValue: "New" }]),
    );
    failApply = true;
    expect((await service.approve(request.id, "all", actor))[0].status).toBe(
      "publish_failed",
    );
    const failed = (await service.get(request.id)).request.items[0];
    expect(failed.publishError).toBe("Publication failed");
    failApply = false;
    expect(
      (await service.retryPublish(request.id, [failed.id], actor))[0].status,
    ).toBe("published");
  });

  it('clears publish failure when the proposed value is edited', async () => {
    const request = await service.create(input([{ fieldKey: 'name', proposedValue: 'First' }]));
    failApply = true;
    await service.approve(request.id, 'all', actor);
    const updated = await service.update(request.id, [{ itemId: request.items[0].id, proposedValue: 'Second' }], actor);
    expect(updated.items[0].state).toBe('proposed');
    expect(updated.items[0].publishError).toBeNull();
  });

  it('keeps a rejection note on a partially open request', async () => {
    const request = await service.create(input([{ fieldKey: 'one', proposedValue: 1 }, { fieldKey: 'two', proposedValue: 2 }]));
    await service.reject(request.id, [request.items[0].id], actor, 'Needs evidence');
    expect((await service.get(request.id)).request.note).toBe('Needs evidence');
  });

  it("edits, rejects, and withdraws", async () => {
    const request = await service.create(
      input([{ fieldKey: "name", proposedValue: "Old" }]),
    );
    const itemId = request.items[0].id;
    expect(
      (
        await service.update(
          request.id,
          [{ itemId, proposedValue: "New" }],
          actor,
        )
      ).items[0].proposedValue,
    ).toBe("New");
    expect(await service.reject(request.id, [itemId], actor)).toEqual([
      { itemId, status: "rejected" },
    ]);
    expect(await service.reject(request.id, [itemId], actor)).toEqual([
      { itemId, status: "alreadyResolved" },
    ]);
    const other = await service.create(
      input([{ fieldKey: "name", proposedValue: "More" }]),
    );
    await service.withdraw(other.id, actor);
    expect(await db.getRepository(ChangeRequestEntity).count()).toBe(0);
  });

  it("rejects unknown targets and duplicate input", async () => {
    expect(() => registry.get("other", "target")).toThrow(
      "change-request.unknown-target",
    );
    await expect(service.create(input([]))).rejects.toThrow(
      "change-request.invalid-items",
    );
    await expect(
      service.create(
        input([
          { fieldKey: "name", proposedValue: 1 },
          { fieldKey: "name", proposedValue: 2 },
        ]),
      ),
    ).rejects.toThrow("change-request.invalid-items");
    expect(CHANGE_REQUEST_ADAPTERS).toBeDefined();
  });

  it('counts all matching open items across pages and filters by state', async () => {
    await service.create(input([{ fieldKey: 'one', proposedValue: 1 }, { fieldKey: 'two', proposedValue: 2 }]));
    const second = await service.create(input([{ fieldKey: 'three', proposedValue: 3 }]));
    live.set('three:', 8);
    await service.approve(second.id, 'all', actor);
    expect((await service.list({ limit: 1 })).openItemCount).toBe(3);
    expect((await service.list({ state: 'stale' })).total).toBe(1);
    expect((await service.list({ entityType: 'wrong' })).openItemCount).toBe(0);
  });

  it('reports missing items and invalid retry states', async () => {
    const request = await service.create(input([{ fieldKey: 'name', proposedValue: 'New' }]));
    await expect(service.update(request.id, [{ itemId: 'missing', proposedValue: 'X' }], actor)).rejects.toThrow('change-request.item-not-found');
    await expect(service.refresh(request.id, ['missing'], actor)).rejects.toThrow('change-request.item-not-found');
    await expect(service.retryPublish(request.id, [request.items[0].id], actor)).rejects.toThrow('change-request.not-failed');
    expect(await service.reject(request.id, ['missing', request.items[0].id], actor, 'No')).toEqual([
      { itemId: 'missing', status: 'alreadyResolved' },
      { itemId: request.items[0].id, status: 'rejected' },
    ]);
    await expect(service.get(request.id)).rejects.toThrow('change-request.not-found');
    expect(await service.approve(request.id, 'all', actor)).toEqual([]);
    expect(await service.reject(request.id, 'all', actor)).toEqual([]);
  });

  it('rejects an adapter that omits a live value and supports runtime registration', async () => {
    registry.register({ ...adapter, entityType: 'broken', read: async () => [] });
    await expect(service.create({ ...input([{ fieldKey: 'name', proposedValue: 'X' }]), entityType: 'broken' })).rejects.toThrow('change-request.missing-live-value');
    registry.register({ ...adapter, entityType: 'broken' });
    expect(registry.get('broken', 'headline').entityType).toBe('broken');
  });

  it('exposes sync and async module registration', async () => {
    const direct = ChangeRequestModule.forRoot([adapter]);
    expect(direct.providers).toContain(ChangeRequestService);
    const asynchronous = ChangeRequestModule.forRootAsync({ useFactory: async () => [adapter] });
    const optionProvider = asynchronous.providers?.[0] as { useFactory: () => Promise<ChangeRequestAdapter[]> };
    expect(await optionProvider.useFactory()).toEqual([adapter]);
  });

  it('reverses and reapplies the migration', async () => {
    const migration = new CreateChangeRequests1727164800000();
    const runner = db.createQueryRunner();
    await migration.down(runner);
    expect(await runner.hasTable('change_requests')).toBe(false);
    await migration.up(runner);
    expect(await runner.hasTable('change_request_items')).toBe(true);
    await runner.release();
  });

  it('accepts optional metadata, nullable proposals and an omitted actor id', async () => {
    const request = await service.create({
      ...input([{ fieldKey: 'name', proposedValue: null }]),
      proposer: { kind: 'agent', label: 'Automation' },
      title: 'Review', note: 'Optional context', source: { generator: 'example' },
    });
    expect(request.proposerId).toBeNull();
    expect(request.items[0].proposedValue).toBeNull();
    expect((await service.list()).total).toBe(1);
    expect((await service.list({ target: 'headline', entityId: 'a1', offset: 0 })).total).toBe(1);
    expect((await service.get(request.id)).items[0].liveValue).toBeNull();
    expect((await service.approve(request.id, 'all', actor))[0].status).toBe('published');
  });

  it('builds an empty module and evaluates the Postgres migration column types', async () => {
    expect(ChangeRequestModule.forRoot().providers).toBeDefined();
    const real = db.createQueryRunner();
    const tables: unknown[] = [];
    const runner = {
      connection: { driver: { options: { type: 'postgres' } } },
      createTable: async (table: unknown) => { tables.push(table); },
      createIndex: async () => undefined,
    } as unknown as typeof real;
    await new CreateChangeRequests1727164800000().up(runner);
    expect((tables[0] as { columns: { name: string; type: string }[] }).columns.find((column) => column.name === 'created_at')?.type).toBe('timestamp');
    await real.release();
  });
});
