import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { DataSource } from 'typeorm';

const { OmniNamedEntity } = await import('../base/omni-named.entity.js');
const { OmniRecordEntity } = await import('../base/omni-record.entity.js');
const { OmniRelationEntity } = await import('../base/omni-relation.entity.js');
const { OmniExternalRefEntity } = await import(
  '../base/omni-external-ref.entity.js'
);
const { OmniRecordStatus } = await import('../omni-record-status.enum.js');
const { OmniRecordService } = await import('../omni-record.service.js');

const scope = {
  scopeId: 'scope-record-guard',
  cacheKey: (key: string) => `scope-record-guard:${key}`,
};
const reservedKind = 'registered_extension';
const ownerGuid = '10000000-0000-4000-8000-000000000301';
const normalGuid = '10000000-0000-4000-8000-000000000302';

describe('OmniRecordService extension owner guard', () => {
  let dataSource: DataSource;
  let service: InstanceType<typeof OmniRecordService>;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [
        OmniNamedEntity,
        OmniRecordEntity,
        OmniRelationEntity,
        OmniExternalRefEntity,
      ],
    });
    await dataSource.initialize();
    service = new OmniRecordService(
      dataSource.getRepository(OmniRecordEntity) as never,
      scope,
      'tombstone',
      [reservedKind],
    );
    await dataSource.getRepository(OmniRecordEntity).save({
      scopeId: scope.scopeId,
      guid: ownerGuid,
      title: 'Extension-owned record',
      kind: reservedKind,
      status: OmniRecordStatus.Active,
      payloadSchemaId: 'registered.extension.v1',
      payloadSchemaVersion: 1,
    });
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('rejects generic creation, mutation, promotion, and deletion of a reserved extension owner', async () => {
    await expect(
      service.createEntity({
        guid: '10000000-0000-4000-8000-000000000303',
        title: 'Attempted extension owner',
        kind: reservedKind,
        status: OmniRecordStatus.Active,
      }),
    ).rejects.toThrow('owned by a registered extension projection');

    await service.createEntity({
      guid: normalGuid,
      title: 'Normal record',
      kind: 'normal_record',
      status: OmniRecordStatus.Active,
    });
    await expect(
      service.updateEntity(
        { guid: normalGuid },
        { kind: reservedKind },
      ),
    ).rejects.toThrow('owned by a registered extension projection');
    await expect(
      service.updateEntity(
        { guid: ownerGuid },
        { kind: 'normal_record' },
      ),
    ).rejects.toThrow('owned by a registered extension projection');
    await expect(service.deleteEntity({ guid: ownerGuid })).rejects.toThrow(
      'owned by a registered extension projection',
    );

    expect(
      await dataSource.getRepository(OmniRecordEntity).findOneByOrFail({
        scopeId: scope.scopeId,
        guid: ownerGuid,
      }),
    ).toMatchObject({
      kind: reservedKind,
      payloadSchemaId: 'registered.extension.v1',
      payloadSchemaVersion: 1,
    });
    expect(
      await dataSource.getRepository(OmniRecordEntity).findOneByOrFail({
        scopeId: scope.scopeId,
        guid: normalGuid,
      }),
    ).toMatchObject({ kind: 'normal_record' });
  });
});
