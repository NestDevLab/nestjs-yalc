import { describe, expect, it } from '@jest/globals';
import { getMetadataArgsStorage } from 'typeorm';

const { OmniRecordEntity } = await import('../base/omni-record.entity.js');
const { OmniDocumentEntity } = await import('../omni-document.entity.js');
const { OmniDocumentKind } = await import('../omni-document-kind.enum.js');

describe('OmniDocumentEntity', () => {
  it('extends OmniRecordEntity', () => {
    expect(new OmniDocumentEntity()).toBeInstanceOf(OmniRecordEntity);
  });

  it('registers document-specific columns', () => {
    const metadata = getMetadataArgsStorage();
    const table = metadata.tables.find(
      (item) => item.target === OmniDocumentEntity,
    );
    const entityColumns = metadata.columns
      .filter((item) => item.target === OmniDocumentEntity)
      .map((item) => item.propertyName);

    expect(table?.name).toBe('omni-document');
    expect(entityColumns).toEqual(
      expect.arrayContaining([
        'documentKind',
        'content',
        'contentMimeType',
        'sourceUrl',
        'publishedAt',
      ]),
    );
  });

  it('defaults the base record kind to document when missing', () => {
    const entity = new OmniDocumentEntity();

    entity.ensureDocumentRecordKind();

    expect(entity.kind).toBe(OmniDocumentKind.Document);
  });

  it('preserves an explicit base record kind when already set', () => {
    const entity = new OmniDocumentEntity();
    entity.kind = OmniDocumentKind.Document;

    entity.ensureDocumentRecordKind();

    expect(entity.kind).toBe(OmniDocumentKind.Document);
  });
});
