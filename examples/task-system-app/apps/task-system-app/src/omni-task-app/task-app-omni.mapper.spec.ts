import { OmniExternalRefInternalType, OmniRecordStatus } from '@nestjs-yalc/omnikernel-module';
import { TaskAppOmniMapper } from './task-app-omni.mapper';

describe('TaskAppOmniMapper', () => {
  const mapper = new TaskAppOmniMapper();

  it('maps task items to Omni records with kind task', () => {
    const record = mapper.mapTaskToOmniRecord({
      description: 'Keep adapters explicit',
      dueAt: '2026-04-08T18:00:00.000Z',
      guid: 'task-1',
      status: 'todo',
      title: 'Adopt OmniKernel',
    });

    expect(record).toMatchObject({
      guid: 'task-1',
      kind: 'task',
      slug: 'adopt-omnikernel',
      status: OmniRecordStatus.Draft,
      title: 'Adopt OmniKernel',
    });
    expect(record.payload).toMatchObject({
      description: 'Keep adapters explicit',
      dueAt: '2026-04-08T18:00:00.000Z',
      taskStatus: 'todo',
    });
  });

  it('maps projects to Omni collections', () => {
    const collection = mapper.mapProjectToOmniCollection({
      description: 'Main backlog',
      guid: 'project-1',
      name: 'Backlog',
      status: 'active',
    });

    expect(collection).toMatchObject({
      collectionKind: 'collection',
      guid: 'project-1',
      kind: 'collection',
      slug: 'backlog',
      summary: 'Main backlog',
      title: 'Backlog',
    });
  });

  it('maps task external refs to Omni record refs by default', () => {
    const ref = mapper.mapExternalRefToOmniExternalRef({
      externalId: 'google-task-1',
      guid: 'ref-1',
      internalId: 'task-1',
      internalType: 'task',
      provider: 'google-tasks',
    });

    expect(ref).toMatchObject({
      externalId: 'google-task-1',
      guid: 'ref-1',
      internalId: 'task-1',
      internalType: OmniExternalRefInternalType.Record,
      provider: 'google-tasks',
    });
    expect(ref.payload).toMatchObject({
      legacyInternalType: 'task',
    });
  });
});
