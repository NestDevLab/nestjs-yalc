import { describe, expect, it, jest } from '@jest/globals';

const { OmniCollectionKind } = await import('../omni-collection-kind.enum.js');
const { OmniDocumentKind } = await import('../omni-document-kind.enum.js');
const { OmniExternalRefInternalType } = await import(
  '../omni-external-ref-internal-type.enum.js'
);
const { OmniKernelQueryService } = await import('../omnikernel.query.service.js');

describe('OmniKernelQueryService', () => {
  it('returns collection members from canonical contains relations', async () => {
    const relationRepository = {
      find: jest.fn(async () => [
        {
          targetRecord: {
            guid: 'doc-1',
            kind: OmniDocumentKind.Document,
          },
        },
      ]),
    };
    const externalRefRepository = {
      find: jest.fn(),
    };
    const service = new OmniKernelQueryService(
      relationRepository as never,
      externalRefRepository as never,
    );

    const result = await service.getCollectionMembers('collection-1');

    expect(relationRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceRecordId: 'collection-1',
        }),
      }),
    );
    expect(result).toEqual([
      {
        guid: 'doc-1',
        kind: OmniDocumentKind.Document,
      },
    ]);
  });

  it('returns parent collections for a document through inverse contains relations', async () => {
    const relationRepository = {
      find: jest.fn(async () => [
        {
          sourceRecord: {
            guid: 'collection-1',
            kind: OmniCollectionKind.Collection,
          },
        },
      ]),
    };
    const externalRefRepository = {
      find: jest.fn(),
    };
    const service = new OmniKernelQueryService(
      relationRepository as never,
      externalRefRepository as never,
    );

    const result = await service.getDocumentCollections('doc-1');

    expect(relationRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          targetRecordId: 'doc-1',
        }),
      }),
    );
    expect(result).toEqual([
      {
        guid: 'collection-1',
        kind: OmniCollectionKind.Collection,
      },
    ]);
  });

  it('filters out inverse contains sources that are not collections', async () => {
    const relationRepository = {
      find: jest.fn(async () => [
        {
          sourceRecord: {
            guid: 'collection-1',
            kind: OmniCollectionKind.Collection,
          },
        },
        {
          sourceRecord: {
            guid: 'doc-2',
            kind: OmniDocumentKind.Document,
          },
        },
      ]),
    };
    const externalRefRepository = {
      find: jest.fn(),
    };
    const service = new OmniKernelQueryService(
      relationRepository as never,
      externalRefRepository as never,
    );

    const result = await service.getDocumentCollections('doc-1');

    expect(result).toEqual([
      {
        guid: 'collection-1',
        kind: OmniCollectionKind.Collection,
      },
    ]);
  });

  it('returns document external refs through the query layer', async () => {
    const relationRepository = {
      find: jest.fn(),
    };
    const externalRefRepository = {
      find: jest.fn(async () => [
        {
          guid: 'ref-1',
          internalType: OmniExternalRefInternalType.Document,
          internalId: 'doc-1',
        },
      ]),
    };
    const service = new OmniKernelQueryService(
      relationRepository as never,
      externalRefRepository as never,
    );

    const result = await service.getDocumentExternalRefs('doc-1', 'github');

    expect(externalRefRepository.find).toHaveBeenCalledWith({
      where: {
        internalType: OmniExternalRefInternalType.Document,
        internalId: 'doc-1',
        provider: 'github',
      },
      order: {
        createdAt: 'ASC',
      },
    });
    expect(result).toEqual([
      {
        guid: 'ref-1',
        internalType: OmniExternalRefInternalType.Document,
        internalId: 'doc-1',
      },
    ]);
  });
});
