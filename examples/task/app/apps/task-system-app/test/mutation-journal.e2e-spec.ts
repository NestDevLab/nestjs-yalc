import { INestApplication } from '@nestjs/common';
import { expect } from '@jest/globals';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  MutationJournalCleanupService,
  MutationJournalQueryService,
  MutationJournalService,
  type MutationJournalRow,
} from '@nestjs-yalc/audit';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

const TASK_TABLE = 'omni-record';
const RETENTION_DAYS = 30;
const MILLISECONDS_PER_DAY = 86_400_000;

describe('Mutation journal e2e', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let cleanupService: MutationJournalCleanupService;
  let journalService: MutationJournalService;
  let queryService: MutationJournalQueryService;
  let taskMutations: MutationJournalRow[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(new FastifyAdapter());
    await app.listen(0);

    dataSource = app.get(DataSource);
    cleanupService = app.get(MutationJournalCleanupService);
    journalService = app.get(MutationJournalService);
    queryService = app.get(MutationJournalQueryService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('installs triggers for the task app tables without journaling internals', () => {
    const [report] = journalService.getReports();

    expect(report).toBeDefined();
    expect(report.journaledTables).toEqual(
      expect.arrayContaining(['omni-named', 'omni-record', 'omni-relation']),
    );
    expect(report.journaledTables).not.toContain('_mutation_journal');
    expect(
      report.journaledTables.some((tableName) =>
        tableName.startsWith('sqlite_'),
      ),
    ).toBe(false);
    expect(report.skippedTables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tableName: '_mutation_journal',
          reason: 'excluded',
        }),
      ]),
    );
  });

  it('journals a task create, update, and delete through the application', async () => {
    const guid = randomUUID();
    const originalTitle = 'Mutation journal task';
    const updatedTitle = 'Mutation journal task complete';

    await request(app.getHttpServer())
      .post('/tasks')
      .send({
        guid,
        title: originalTitle,
        description: 'Created through the task app',
        status: 'todo',
      })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/tasks/${guid}`)
      .send({ title: updatedTitle, status: 'done' })
      .expect(200);

    await request(app.getHttpServer()).delete(`/tasks/${guid}`).expect(200);

    const rows = await queryService.find(undefined, {
      limit: 100,
      tableName: TASK_TABLE,
    });
    taskMutations = rows.filter((row) => rowContainsGuid(row, guid));

    expect(taskMutations).toHaveLength(3);
    expect(taskMutations.map((row) => row.action)).toEqual([
      'delete',
      'update',
      'insert',
    ]);

    const [deleted, updated, inserted] = taskMutations;
    expect(deleted.oldRow).not.toBeNull();
    expect(deleted.newRow).toBeNull();
    expect(JSON.parse(deleted.oldRow ?? '')).toMatchObject({
      guid,
      kind: 'task',
      title: updatedTitle,
    });

    expect(updated.oldRow).not.toBeNull();
    expect(updated.newRow).not.toBeNull();
    expect(JSON.parse(updated.oldRow ?? '')).toMatchObject({
      guid,
      kind: 'task',
      title: originalTitle,
    });
    expect(JSON.parse(updated.newRow ?? '')).toMatchObject({
      guid,
      kind: 'task',
      title: updatedTitle,
    });

    expect(inserted.oldRow).toBeNull();
    expect(inserted.newRow).not.toBeNull();
    expect(JSON.parse(inserted.newRow ?? '')).toMatchObject({
      guid,
      kind: 'task',
      title: originalTitle,
    });
  });

  it('removes expired rows while preserving fresh task mutations', async () => {
    const oldOccurredAt =
      Date.now() - (RETENTION_DAYS + 1) * MILLISECONDS_PER_DAY;
    await dataSource.query(
      'INSERT INTO "_mutation_journal" ("occurredAt", "tableName", "action", "oldRow", "newRow", "actor") VALUES (?, ?, ?, ?, ?, ?)',
      [oldOccurredAt, 'expired-row', 'insert', null, '{}', null],
    );

    expect(await cleanupService.runOnce()).toBe(1);

    const expiredRows = await queryService.find(undefined, {
      tableName: 'expired-row',
    });
    const remainingTaskRows = await queryService.find(undefined, {
      limit: 100,
      tableName: TASK_TABLE,
    });

    expect(expiredRows).toEqual([]);
    expect(remainingTaskRows.map((row) => row.id)).toEqual(
      expect.arrayContaining(taskMutations.map((row) => row.id)),
    );
  });
});

function rowContainsGuid(row: MutationJournalRow, guid: string): boolean {
  return [row.oldRow, row.newRow].some((value) => {
    if (!value) {
      return false;
    }

    return (JSON.parse(value) as { guid?: string }).guid === guid;
  });
}
