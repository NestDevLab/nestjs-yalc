import { describe, expect, it } from '@jest/globals';
import { getMetadataArgsStorage } from 'typeorm';

const { OmniNamedEntity } = await import('../base/omni-named.entity.js');
const { OmniRecordEntity } = await import('../base/omni-record.entity.js');

describe('OmniRecordEntity', () => {
  it('extends OmniNamedEntity', () => {
    expect(new OmniRecordEntity()).toBeInstanceOf(OmniNamedEntity);
  });

  it('registers core columns and directional relations', () => {
    const metadata = getMetadataArgsStorage();
    const table = metadata.tables.find(
      (item) => item.target === OmniRecordEntity,
    );
    const entityColumns = metadata.columns
      .filter((item) => item.target === OmniRecordEntity)
      .map((item) => item.propertyName);
    const relations = metadata.relations
      .filter((item) => item.target === OmniRecordEntity)
      .map((item) => item.propertyName);

    expect(table?.name).toBe('omni-record');
    expect(entityColumns).toEqual(
      expect.arrayContaining(['kind', 'status', 'payload']),
    );
    expect(relations).toEqual(
      expect.arrayContaining(['outgoingRelations', 'incomingRelations']),
    );
  });
});
