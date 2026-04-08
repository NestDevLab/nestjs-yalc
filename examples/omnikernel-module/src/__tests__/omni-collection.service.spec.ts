import { describe, expect, it, jest } from '@jest/globals';

const { OmniCollectionService } = await import('../omni-collection.service.js');
const { OmniCollectionEntity } = await import('../omni-collection.entity.js');
const { OmniCollectionKind } = await import('../omni-collection-kind.enum.js');

const createRepositoryPair = () => {
  const readRepository = {
    target: OmniCollectionEntity,
    findOneOrFail: jest.fn(),
    getId: jest.fn((entity: OmniCollectionEntity) => ({ guid: entity.guid })),
  };
  const writeRepository = {
    target: OmniCollectionEntity,
    create: jest.fn((input: unknown) => input),
    insert: jest.fn(async () => ({
      identifiers: [{ guid: 'aaaaaaaa-1111-1111-1111-111111111111' }],
    })),
    update: jest.fn(async () => ({ affected: 1 })),
  };

  return { readRepository, writeRepository };
};

describe('OmniCollectionService', () => {
  it('forces the base record kind during createEntity', async () => {
    const { readRepository, writeRepository } = createRepositoryPair();
    const service = new OmniCollectionService(
      readRepository as never,
      writeRepository as never,
    );

    await service.createEntity(
      {
        guid: 'aaaaaaaa-1111-1111-1111-111111111111',
        title: 'Collection',
        kind: 'unexpected-kind',
        collectionKind: OmniCollectionKind.Folder,
      },
      undefined,
      false,
    );

    expect(writeRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: OmniCollectionKind.Collection,
        collectionKind: OmniCollectionKind.Folder,
      }),
    );
  });

  it('forces the base record kind during updateEntity', async () => {
    const { readRepository, writeRepository } = createRepositoryPair();
    const service = new OmniCollectionService(
      readRepository as never,
      writeRepository as never,
    );
    (service as any).validateConditions = jest.fn(async () => ({
      guid: 'aaaaaaaa-1111-1111-1111-111111111111',
    }));

    await service.updateEntity(
      { guid: 'aaaaaaaa-1111-1111-1111-111111111111' },
      {
        kind: 'unexpected-kind',
        collectionKind: OmniCollectionKind.Folder,
      },
      undefined,
      false,
    );

    expect(writeRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        guid: 'aaaaaaaa-1111-1111-1111-111111111111',
        kind: OmniCollectionKind.Collection,
      }),
      expect.objectContaining({
        kind: OmniCollectionKind.Collection,
        collectionKind: OmniCollectionKind.Folder,
      }),
    );
  });
});
