import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { DataSource } from 'typeorm';

const { OmniNamedEntity } = await import('../base/omni-named.entity.js');
const { OmniRecordEntity } = await import('../base/omni-record.entity.js');
const { OmniRelationEntity } = await import('../base/omni-relation.entity.js');
const { OmniCollectionEntity } = await import('../omni-collection.entity.js');
const { OmniCollectionKind } = await import('../omni-collection-kind.enum.js');
const { OmniDocumentEntity } = await import('../omni-document.entity.js');
const { OmniDocumentKind } = await import('../omni-document-kind.enum.js');
const { OmniRecordStatus } = await import('../omni-record-status.enum.js');
const { OmniRelationKind } = await import('../omni-relation-kind.enum.js');
const { OmniRelationStatus } = await import('../omni-relation-status.enum.js');

describe('OmniKernel persistence', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [
        OmniNamedEntity,
        OmniRecordEntity,
        OmniCollectionEntity,
        OmniDocumentEntity,
        OmniRelationEntity,
      ],
    });

    await dataSource.initialize();
  });

  afterEach(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('stores collections and documents in omni-record and resolves graph links back through the shared record hierarchy', async () => {
    const recordRepo = dataSource.getRepository(OmniRecordEntity);
    const collectionRepo = dataSource.getRepository(OmniCollectionEntity);
    const documentRepo = dataSource.getRepository(OmniDocumentEntity);
    const relationRepo = dataSource.getRepository(OmniRelationEntity);

    await recordRepo.insert(
      recordRepo.create({
        guid: '11111111-1111-1111-1111-111111111111',
        title: 'Task record',
        kind: 'task',
        status: OmniRecordStatus.Draft,
      }),
    );
    await documentRepo.insert(
      documentRepo.create({
        guid: '22222222-2222-2222-2222-222222222222',
        title: 'Document record',
        status: OmniRecordStatus.Draft,
        documentKind: OmniDocumentKind.Note,
      }),
    );
    await collectionRepo.insert(
      collectionRepo.create({
        guid: '44444444-4444-4444-4444-444444444444',
        title: 'Knowledge base',
        status: OmniRecordStatus.Active,
        collectionKind: OmniCollectionKind.Folder,
        summary: 'Primary document container',
      }),
    );
    await relationRepo.insert(
      relationRepo.create({
        guid: '33333333-3333-3333-3333-333333333333',
        sourceRecordId: '11111111-1111-1111-1111-111111111111',
        targetRecordId: '22222222-2222-2222-2222-222222222222',
        kind: OmniRelationKind.References,
        status: OmniRelationStatus.Active,
      }),
    );
    await relationRepo.insert(
      relationRepo.create({
        guid: '55555555-5555-5555-5555-555555555555',
        sourceRecordId: '44444444-4444-4444-4444-444444444444',
        targetRecordId: '22222222-2222-2222-2222-222222222222',
        kind: OmniRelationKind.Contains,
        status: OmniRelationStatus.Active,
      }),
    );

    const rows = await dataSource.query(
      'select guid, kind, recordType, collectionKind, documentKind from "omni-record" order by guid',
    );

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guid: '11111111-1111-1111-1111-111111111111',
          kind: 'task',
        }),
        expect.objectContaining({
          guid: '22222222-2222-2222-2222-222222222222',
          kind: OmniDocumentKind.Document,
          recordType: OmniDocumentKind.Document,
          documentKind: OmniDocumentKind.Note,
        }),
        expect.objectContaining({
          guid: '44444444-4444-4444-4444-444444444444',
          kind: OmniCollectionKind.Collection,
          recordType: OmniCollectionKind.Collection,
          collectionKind: OmniCollectionKind.Folder,
        }),
      ]),
    );

    const relation = await relationRepo.findOneOrFail({
      where: { guid: '33333333-3333-3333-3333-333333333333' },
      relations: {
        sourceRecord: true,
        targetRecord: true,
      },
    });

    expect(relation.sourceRecord.guid).toBe(
      '11111111-1111-1111-1111-111111111111',
    );
    expect(relation.targetRecord).toBeInstanceOf(OmniDocumentEntity);
    expect(relation.targetRecord.guid).toBe(
      '22222222-2222-2222-2222-222222222222',
    );
    expect((relation.targetRecord as OmniDocumentEntity).kind).toBe(
      OmniDocumentKind.Document,
    );

    const membershipRelation = await relationRepo.findOneOrFail({
      where: { guid: '55555555-5555-5555-5555-555555555555' },
      relations: {
        sourceRecord: true,
        targetRecord: true,
      },
    });

    expect(membershipRelation.sourceRecord).toBeInstanceOf(OmniCollectionEntity);
    expect(membershipRelation.sourceRecord.guid).toBe(
      '44444444-4444-4444-4444-444444444444',
    );
    expect((membershipRelation.sourceRecord as OmniCollectionEntity).kind).toBe(
      OmniCollectionKind.Collection,
    );
    expect(membershipRelation.targetRecord).toBeInstanceOf(OmniDocumentEntity);
    expect(membershipRelation.kind).toBe(OmniRelationKind.Contains);
  });
});
