import { describe, expect, it } from '@jest/globals';
import { getMetadataArgsStorage } from 'typeorm';

const { OmniBaseEntity } = await import('../base/omni-base.entity.js');
const { OmniNamedEntity } = await import('../base/omni-named.entity.js');

describe('OmniNamedEntity', () => {
  it('extends OmniBaseEntity', () => {
    expect(new OmniNamedEntity()).toBeInstanceOf(OmniBaseEntity);
  });

  it('registers the expected table and columns', () => {
    const metadata = getMetadataArgsStorage();
    const table = metadata.tables.find(
      (item) => item.target === OmniNamedEntity,
    );
    const baseColumns = metadata.columns
      .filter((item) => item.target === OmniBaseEntity)
      .map((item) => item.propertyName);
    const entityColumns = metadata.columns
      .filter((item) => item.target === OmniNamedEntity)
      .map((item) => item.propertyName);

    expect(table?.name).toBe('omni-named');
    expect(baseColumns).toEqual(expect.arrayContaining(['guid']));
    expect(metadata.columns.map((item) => item.propertyName)).toEqual(
      expect.arrayContaining(['createdAt', 'updatedAt']),
    );
    expect(entityColumns).toEqual(
      expect.arrayContaining(['externalId', 'title', 'slug']),
    );
  });
});
