import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import {
  OmniExternalRefEntity,
  OmniExternalRefInternalType,
  OmniRelationEntity,
  OmniRelationKind,
} from '@nestjs-yalc/omnikernel-module';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { TaskAppOmniExternalRefService } from './task-app-omni-external-ref.service';
import { TaskAppOmniProjectService } from './task-app-omni-project.service';
import { TaskAppOmniTaskService } from './task-app-omni-task.service';

describe('Task app OmniKernel integration', () => {
  let app: INestApplication;
  let projectService: TaskAppOmniProjectService;
  let taskService: TaskAppOmniTaskService;
  let externalRefService: TaskAppOmniExternalRefService;
  let relationRepository: Repository<OmniRelationEntity>;
  let externalRefRepository: Repository<OmniExternalRefEntity>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    projectService = app.get(TaskAppOmniProjectService);
    taskService = app.get(TaskAppOmniTaskService);
    externalRefService = app.get(TaskAppOmniExternalRefService);
    relationRepository = app.get(
      getRepositoryToken(OmniRelationEntity, 'default'),
    );
    externalRefRepository = app.get(
      getRepositoryToken(OmniExternalRefEntity, 'default'),
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('writes task membership through Omni collection contains relations and reads it back', async () => {
    const projectGuid = randomUUID();
    const taskGuid = randomUUID();

    await projectService.create({
      guid: projectGuid,
      name: 'Omni backlog',
      status: 'active',
    });

    await taskService.create({
      guid: taskGuid,
      projectId: projectGuid,
      status: 'todo',
      title: 'Wire task storage',
    });

    const taskList = await taskService.list({
      projectId: projectGuid,
      startRow: 0,
    });

    expect(taskList.list).toHaveLength(1);
    expect(taskList.list[0]).toMatchObject({
      guid: taskGuid,
      projectId: projectGuid,
      title: 'Wire task storage',
    });

    const containsRelation = await relationRepository.findOne({
      where: {
        kind: OmniRelationKind.Contains,
        sourceRecordId: projectGuid,
        targetRecordId: taskGuid,
      },
    });

    expect(containsRelation).not.toBeNull();
  });

  it('writes task cross-links through references and related_to relations', async () => {
    const projectGuid = randomUUID();
    const mainTaskGuid = randomUUID();
    const referenceTaskGuid = randomUUID();
    const relatedTaskGuid = randomUUID();

    await projectService.create({
      guid: projectGuid,
      name: 'Task graph project',
      status: 'active',
    });

    await taskService.create({
      guid: referenceTaskGuid,
      projectId: projectGuid,
      status: 'todo',
      title: 'Referenced task',
    });

    await taskService.create({
      guid: relatedTaskGuid,
      projectId: projectGuid,
      status: 'todo',
      title: 'Related task',
    });

    await taskService.create({
      guid: mainTaskGuid,
      projectId: projectGuid,
      referenceIds: [referenceTaskGuid],
      relatedToIds: [relatedTaskGuid],
      status: 'todo',
      title: 'Primary task',
    });

    const relations = await relationRepository.find({
      where: [
        {
          kind: OmniRelationKind.References,
          sourceRecordId: mainTaskGuid,
          targetRecordId: referenceTaskGuid,
        },
        {
          kind: OmniRelationKind.RelatedTo,
          sourceRecordId: mainTaskGuid,
          targetRecordId: relatedTaskGuid,
        },
      ],
    });

    expect(relations).toHaveLength(2);
    expect(relations.map((relation) => relation.kind).sort()).toEqual([
      OmniRelationKind.References,
      OmniRelationKind.RelatedTo,
    ]);
  });

  it('stores task external refs in OmniExternalRefEntity with internalType record', async () => {
    const projectGuid = randomUUID();
    const taskGuid = randomUUID();
    const refGuid = randomUUID();

    await projectService.create({
      guid: projectGuid,
      name: 'External sync project',
      status: 'active',
    });

    await taskService.create({
      guid: taskGuid,
      projectId: projectGuid,
      status: 'todo',
      title: 'Sync to provider',
    });

    await externalRefService.create({
      externalId: 'google-task-123',
      guid: refGuid,
      internalId: taskGuid,
      internalType: 'task',
      provider: 'google-tasks',
    });

    const storedRef = await externalRefRepository.findOneOrFail({
      where: {
        guid: refGuid,
      },
    });

    expect(storedRef.internalType).toBe(OmniExternalRefInternalType.Record);
    expect(storedRef.internalId).toBe(taskGuid);
    expect(storedRef.payload).toMatchObject({
      legacyInternalType: 'task',
    });
  });
});
