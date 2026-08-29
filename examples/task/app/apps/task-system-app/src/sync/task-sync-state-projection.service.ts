import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  applyProjectionIndexesForBootstrap,
  ProjectionResourceService,
  type ProjectionDialect,
  type ProjectionScope,
} from '@nestjs-yalc/crud-gen';
import { YalcEventService } from '@nestjs-yalc/event-manager';
import { type DataSource } from 'typeorm';
import { TaskAppOmniExternalRefService } from '../omni-task-app/task-app-omni-external-ref.service';
import {
  taskSyncStateProjectionDefinition,
  TaskSyncStateProjection,
} from './task-sync-state.projection';

export const TASK_SYNC_STATE_PROJECTION_SCOPE = Symbol(
  'TASK_SYNC_STATE_PROJECTION_SCOPE',
);
export const TASK_SYNC_STATE_PROJECTION_DIALECT = Symbol(
  'TASK_SYNC_STATE_PROJECTION_DIALECT',
);

/**
 * The Task App uses an isolated in-memory SQLite database for development and
 * e2e tests, so its projection indexes can safely be compiled at bootstrap.
 */
@Injectable()
export class TaskSyncStateProjectionIndexesBootstrap implements OnApplicationBootstrap {
  constructor(
    @Inject(getDataSourceToken()) private readonly dataSource: DataSource,
    @Inject(TASK_SYNC_STATE_PROJECTION_DIALECT)
    private readonly dialect: ProjectionDialect,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await applyProjectionIndexesForBootstrap(
      this.dataSource,
      this.dialect,
      taskSyncStateProjectionDefinition,
    );
  }
}

/**
 * ProjectionResourceService owns CRUD. This adapter keeps the one Task App
 * sync invariant that cannot be represented by the generic field contract:
 * every sync state must refer to an existing external reference.
 */
@Injectable()
export class TaskSyncStateProjectionService extends ProjectionResourceService<TaskSyncStateProjection> {
  constructor(
    @Inject(getDataSourceToken()) dataSource: DataSource,
    @Inject(TASK_SYNC_STATE_PROJECTION_SCOPE)
    scope: ProjectionScope,
    @Inject(TASK_SYNC_STATE_PROJECTION_DIALECT)
    dialect: ProjectionDialect,
    events: YalcEventService,
    private readonly externalRefService: TaskAppOmniExternalRefService,
  ) {
    super(
      dataSource.getRepository(TaskSyncStateProjection),
      scope,
      dialect,
      events,
      taskSyncStateProjectionDefinition,
    );
  }

  override async createEntity(
    input: Record<string, unknown>,
  ): Promise<TaskSyncStateProjection> {
    await this.assertExternalRef(input.externalRefId);
    return super.createEntity(input);
  }

  override async updateEntity(
    conditions: Record<string, unknown>,
    input: Record<string, unknown>,
  ): Promise<TaskSyncStateProjection> {
    const current = await super.getEntity(
      conditions,
      undefined,
      undefined,
      undefined,
      { failOnNull: true },
    );
    const externalRefId =
      input.externalRefId ??
      (current as unknown as { externalRefId?: unknown } | null)?.externalRefId;

    await this.assertExternalRef(externalRefId);
    return super.updateEntity(conditions, input);
  }

  private async assertExternalRef(externalRefId: unknown): Promise<void> {
    if (typeof externalRefId === 'string') {
      await this.externalRefService.getById(externalRefId);
    }
  }
}
