import { describe, expect, it } from '@jest/globals';
import { getMetadataArgsStorage } from 'typeorm';

const { OmniRecordEntity } = await import('../base/omni-record.entity.js');
const { OmniDocumentEntity } = await import('../omni-document.entity.js');
const { OmniDocumentKind } = await import('../omni-document-kind.enum.js');

describe('OmniDocumentEntity', () => {
  it('extends OmniRecordEntity', () => {
    expect(new OmniDocumentEntity()).toBeInstanceOf(OmniRecordEntity);
  });

  it('stores documents as child records in the omni-record table', () => {
    const metadata = getMetadataArgsStorage();
    const recordTable = metadata.tables.find(
      (item) => item.target === OmniRecordEntity,
    );
    const documentTable = metadata.tables.find(
      (item) => item.target === OmniDocumentEntity,
    );
    const inheritance = metadata.inheritances.find(
      (item) => item.target === OmniRecordEntity,
    );
    const entityColumns = metadata.columns
      .filter((item) => item.target === OmniDocumentEntity)
      .map((item) => item.propertyName);

    expect(recordTable?.name).toBe('omni-record');
    expect(documentTable?.type).toBe('entity-child');
    expect(inheritance?.column).toMatchObject({ name: 'recordType' });
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

  it('defaults the base record kind to document in the class instance', () => {
    const entity = new OmniDocumentEntity();

    expect(entity.kind).toBe(OmniDocumentKind.Document);
  });

  it('allows explicit document subtypes while keeping the base record kind stable', () => {
    const entity = new OmniDocumentEntity();
    entity.documentKind = OmniDocumentKind.Note;

    expect(entity.kind).toBe(OmniDocumentKind.Document);
    expect(entity.documentKind).toBe(OmniDocumentKind.Note);
  });
});
