import { describe, expect, it } from '@jest/globals';
import { getMetadataArgsStorage } from 'typeorm';

const { OmniBaseEntity } = await import('../base/omni-base.entity.js');
const {
  OmniExternalRefEntity,
} = await import('../base/omni-external-ref.entity.js');

describe('OmniExternalRefEntity', () => {
  it('extends OmniBaseEntity', () => {
    expect(new OmniExternalRefEntity()).toBeInstanceOf(OmniBaseEntity);
  });

  it('registers external mapping columns', () => {
    const metadata = getMetadataArgsStorage();
    const table = metadata.tables.find(
      (item) => item.target === OmniExternalRefEntity,
    );
    const entityColumns = metadata.columns
      .filter((item) => item.target === OmniExternalRefEntity)
      .map((item) => item.propertyName);

    expect(table?.name).toBe('omni-external-ref');
    expect(entityColumns).toEqual(
      expect.arrayContaining([
        'internalType',
        'internalId',
        'provider',
        'account',
        'container',
        'externalId',
        'payload',
      ]),
    );
  });
});
