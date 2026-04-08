import { describe, expect, it, jest } from '@jest/globals';

const { OmniExternalRefService } = await import('../omni-external-ref.service.js');
const { OmniExternalRefEntity } = await import(
  '../base/omni-external-ref.entity.js'
);
const { OmniExternalRefInternalType } = await import(
  '../omni-external-ref-internal-type.enum.js'
);

const createRepositoryPair = () => {
  const readRepository = {
    target: OmniExternalRefEntity,
    findOne: jest.fn(),
    find: jest.fn(),
    findOneOrFail: jest.fn(),
    getId: jest.fn((entity: OmniExternalRefEntity) => ({ guid: entity.guid })),
  };
  const writeRepository = {
    target: OmniExternalRefEntity,
    create: jest.fn((input: unknown) => input),
    insert: jest.fn(async () => ({
      identifiers: [{ guid: 'eeeeeeee-1111-1111-1111-111111111111' }],
    })),
    update: jest.fn(async () => ({ affected: 1 })),
  };

  return { readRepository, writeRepository };
};

describe('OmniExternalRefService', () => {
  it('looks up references by provider/external identity', async () => {
    const { readRepository, writeRepository } = createRepositoryPair();
    const service = new OmniExternalRefService(
      readRepository as never,
      writeRepository as never,
    );

    await service.findByExternalIdentity({
      provider: 'github',
      externalId: '123',
      account: 'acme',
      container: 'kb',
    });

    expect(readRepository.findOne).toHaveBeenCalledWith({
      where: {
        provider: 'github',
        externalId: '123',
        account: 'acme',
        container: 'kb',
      },
    });
  });

  it('returns all references for an internal record', async () => {
    const { readRepository, writeRepository } = createRepositoryPair();
    const service = new OmniExternalRefService(
      readRepository as never,
      writeRepository as never,
    );

    await service.findForInternalRecord(
      OmniExternalRefInternalType.Document,
      'doc-1',
      'github',
    );

    expect(readRepository.find).toHaveBeenCalledWith({
      where: {
        internalType: OmniExternalRefInternalType.Document,
        internalId: 'doc-1',
        provider: 'github',
      },
      order: {
        createdAt: 'ASC',
      },
    });
  });

  it('creates a new external ref when the identity does not exist', async () => {
    const { readRepository, writeRepository } = createRepositoryPair();
    readRepository.findOne.mockResolvedValue(null);
    const service = new OmniExternalRefService(
      readRepository as never,
      writeRepository as never,
    );
    const createSpy = jest
      .spyOn(service, 'createEntity')
      .mockResolvedValue({ guid: 'created' } as OmniExternalRefEntity);

    const result = await service.upsertExternalRef({
      internalType: OmniExternalRefInternalType.Document,
      internalId: 'doc-1',
      provider: 'github',
      externalId: '123',
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        internalType: OmniExternalRefInternalType.Document,
        internalId: 'doc-1',
      }),
    );
    expect(result.guid).toBe('created');
  });

  it('updates an existing external ref when the identity already exists', async () => {
    const { readRepository, writeRepository } = createRepositoryPair();
    readRepository.findOne.mockResolvedValue({
      guid: 'existing-guid',
    });
    const service = new OmniExternalRefService(
      readRepository as never,
      writeRepository as never,
    );
    const updateSpy = jest
      .spyOn(service, 'updateEntity')
      .mockResolvedValue({ guid: 'existing-guid' } as OmniExternalRefEntity);

    const result = await service.upsertExternalRef({
      internalType: OmniExternalRefInternalType.Document,
      internalId: 'doc-1',
      provider: 'github',
      externalId: '123',
      payload: { synced: true },
    });

    expect(updateSpy).toHaveBeenCalledWith(
      { guid: 'existing-guid' },
      expect.objectContaining({
        internalId: 'doc-1',
        payload: { synced: true },
      }),
    );
    expect(result.guid).toBe('existing-guid');
  });

  it('rejects blank provider or external identity during upsert', async () => {
    const { readRepository, writeRepository } = createRepositoryPair();
    const service = new OmniExternalRefService(
      readRepository as never,
      writeRepository as never,
    );

    await expect(
      service.upsertExternalRef({
        internalType: OmniExternalRefInternalType.Document,
        internalId: 'doc-1',
        provider: '',
        externalId: '123',
      }),
    ).rejects.toThrow('OmniExternalRef.provider is required');

    await expect(
      service.upsertExternalRef({
        internalType: OmniExternalRefInternalType.Document,
        internalId: 'doc-1',
        provider: 'github',
        externalId: '   ',
      }),
    ).rejects.toThrow('OmniExternalRef.externalId is required');
  });

  it('syncs document references with the document internal type', async () => {
    const { readRepository, writeRepository } = createRepositoryPair();
    const service = new OmniExternalRefService(
      readRepository as never,
      writeRepository as never,
    );
    const upsertSpy = jest
      .spyOn(service, 'upsertExternalRef')
      .mockResolvedValue({ guid: 'doc-ref' } as OmniExternalRefEntity);

    await service.syncDocumentReference('doc-1', {
      provider: 'github',
      externalId: '123',
      account: 'acme',
    });

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        internalType: OmniExternalRefInternalType.Document,
        internalId: 'doc-1',
      }),
    );
  });
});
