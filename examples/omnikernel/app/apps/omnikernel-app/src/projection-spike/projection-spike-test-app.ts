import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { type DataSource } from 'typeorm';
import {
  applyProjectionIndexesForBootstrap,
  type ProjectionDialect,
} from '@nestjs-yalc/crud-gen';
import { projectionRecordDefinition } from './projection-spike.definition';
import {
  PROJECTION_SPIKE_DIALECT,
  ProjectionSpikeAppModule,
  type ProjectionSpikeModuleOptions,
} from './projection-spike.module';

export type ProjectionSpikeDialect = ProjectionSpikeModuleOptions['dialect'];

export async function createProjectionSpikeTestApp(
  options: ProjectionSpikeModuleOptions,
): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [ProjectionSpikeAppModule.register(options)],
  }).compile();
  const app = moduleFixture.createNestApplication();
  await app.init();
  await applyProjectionIndexesForBootstrap(
    app.get<DataSource>(getDataSourceToken()),
    app.get<ProjectionDialect>(PROJECTION_SPIKE_DIALECT),
    projectionRecordDefinition,
  );
  return app;
}
