import { describe, expect, it } from '@jest/globals';
import { getMetadataArgsStorage } from 'typeorm';

const { OmniRecordEntity } = await import('../base/omni-record.entity.js');
const { OmniCollectionEntity } = await import('../omni-collection.entity.js');
const { OmniCollectionKind } = await import('../omni-collection-kind.enum.js');

describe('OmniCollectionEntity', () => {
  it('extends OmniRecordEntity', () => {
    expect(new OmniCollectionEntity()).toBeInstanceOf(OmniRecordEntity);
  });

  it('stores collections as child records in the omni-record table', () => {
    const metadata = getMetadataArgsStorage();
    const recordTable = metadata.tables.find(
      (item) => item.target === OmniRecordEntity,
    );
    const collectionTable = metadata.tables.find(
      (item) => item.target === OmniCollectionEntity,
    );
    const inheritance = metadata.inheritances.find(
      (item) => item.target === OmniRecordEntity,
    );
    const entityColumns = metadata.columns
      .filter((item) => item.target === OmniCollectionEntity)
      .map((item) => item.propertyName);

    expect(recordTable?.name).toBe('omni-record');
    expect(collectionTable?.type).toBe('entity-child');
    expect(inheritance?.column).toMatchObject({ name: 'recordType' });
    expect(entityColumns).toEqual(
      expect.arrayContaining(['collectionKind', 'summary']),
    );
  });

  it('defaults the base record kind to collection in the class instance', () => {
    const entity = new OmniCollectionEntity();

    expect(entity.kind).toBe(OmniCollectionKind.Collection);
  });

  it('allows explicit collection subtypes while keeping the base record kind stable', () => {
    const entity = new OmniCollectionEntity();
    entity.collectionKind = OmniCollectionKind.Folder;

    expect(entity.kind).toBe(OmniCollectionKind.Collection);
    expect(entity.collectionKind).toBe(OmniCollectionKind.Folder);
  });
});
