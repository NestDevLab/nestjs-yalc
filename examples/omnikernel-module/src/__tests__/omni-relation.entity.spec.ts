import { describe, expect, it } from '@jest/globals';
import { getMetadataArgsStorage } from 'typeorm';

const { OmniBaseEntity } = await import('../base/omni-base.entity.js');
const { OmniRelationEntity } = await import('../base/omni-relation.entity.js');

describe('OmniRelationEntity', () => {
  it('extends OmniBaseEntity', () => {
    expect(new OmniRelationEntity()).toBeInstanceOf(OmniBaseEntity);
  });

  it('registers the record linkage columns and relations', () => {
    const metadata = getMetadataArgsStorage();
    const table = metadata.tables.find(
      (item) => item.target === OmniRelationEntity,
    );
    const entityColumns = metadata.columns
      .filter((item) => item.target === OmniRelationEntity)
      .map((item) => item.propertyName);
    const relations = metadata.relations
      .filter((item) => item.target === OmniRelationEntity)
      .map((item) => item.propertyName);

    expect(table?.name).toBe('omni-relation');
    expect(entityColumns).toEqual(
      expect.arrayContaining([
        'sourceRecordId',
        'targetRecordId',
        'kind',
        'status',
        'payload',
      ]),
    );
    expect(relations).toEqual(
      expect.arrayContaining(['sourceRecord', 'targetRecord']),
    );
  });
});
