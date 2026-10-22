import { describe, expect, it, jest } from '@jest/globals';
import {
  resolveCrudGenRepositoryCapabilities,
  supportsCrudGenStructuredGraphqlFilters,
  type CrudGenRepositoryCapabilityProvider,
} from '../crud-gen-capabilities.js';
import {
  GenericTypeORMRepository,
  PLAIN_CRUD_GEN_REPOSITORY_CAPABILITIES,
} from '../typeorm/generic.repository.js';
import { GenericService } from '../typeorm/generic.service.js';
import { ProjectionResourceService } from '../projection/projection.service.js';

const extendedMethods = () => ({
  getManyExtended: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
  getManyAndCountExtended: jest
    .fn<() => Promise<[unknown[], number]>>()
    .mockResolvedValue([[], 0]),
});

describe('CrudGen repository capability boundary', () => {
  it('retains the repository subpath exports and first-party declaration', () => {
    expect(PLAIN_CRUD_GEN_REPOSITORY_CAPABILITIES).toEqual({
      extendedQueries: false,
      structuredGraphqlFilters: false,
    });
    const repository = Object.create(GenericTypeORMRepository.prototype);
    expect(resolveCrudGenRepositoryCapabilities(repository)).toEqual({
      extendedQueries: true,
      structuredGraphqlFilters: true,
    });
  });

  it.each([true, false])(
    'honors explicit extendedQueries=%s over legacy signals',
    (enabled) => {
      const legacy = jest.fn(() => !enabled);
      const repository = {
        ...extendedMethods(),
        supportsExtendedRepository: legacy,
        getCrudGenCapabilities: () => ({
          extendedQueries: enabled,
          structuredGraphqlFilters: !enabled,
        }),
      };
      const provider: CrudGenRepositoryCapabilityProvider = repository;
      expect(resolveCrudGenRepositoryCapabilities(provider)).toEqual({
        extendedQueries: enabled,
        structuredGraphqlFilters: !enabled,
      });
      expect(legacy).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{}, { extendedQueries: false, structuredGraphqlFilters: false }],
    [
      { extendedQueries: true },
      { extendedQueries: true, structuredGraphqlFilters: false },
    ],
    [
      { structuredGraphqlFilters: true },
      { extendedQueries: false, structuredGraphqlFilters: true },
    ],
  ])('defaults only omitted flags to false: %j', (declaration, expected) => {
    expect(
      resolveCrudGenRepositoryCapabilities({
        ...extendedMethods(),
        getCrudGenCapabilities: () => declaration,
      }),
    ).toEqual(expected);
  });

  it.each([null, undefined, [], true, 'extended'])(
    'rejects invalid declaration %j without inference',
    (declaration) => {
      expect(() =>
        resolveCrudGenRepositoryCapabilities({
          ...extendedMethods(),
          getCrudGenCapabilities: () => declaration,
        }),
      ).toThrow('CrudGen repository capabilities must be an object.');
    },
  );

  it.each(['extendedQueries', 'structuredGraphqlFilters'])(
    'rejects non-boolean %s values',
    (key) => {
      for (const value of [undefined, null, 0, 1, 'false', {}]) {
        expect(() =>
          resolveCrudGenRepositoryCapabilities({
            getCrudGenCapabilities: () => ({ [key]: value }),
          }),
        ).toThrow(`CrudGen repository capability ${key} must be a boolean.`);
      }
    },
  );

  it('rejects a malformed provider and propagates provider errors', () => {
    expect(() =>
      resolveCrudGenRepositoryCapabilities({ getCrudGenCapabilities: true }),
    ).toThrow('must be a function');
    const error = new Error('provider failed');
    expect(() =>
      resolveCrudGenRepositoryCapabilities({
        getCrudGenCapabilities: () => {
          throw error;
        },
      }),
    ).toThrow(error);
  });

  it('preserves provider this binding, ignores future keys and returns a fresh result', () => {
    const declaration = { extendedQueries: true, futureFlag: 'future' };
    const repository = {
      declaration,
      getCrudGenCapabilities() {
        return this.declaration;
      },
    };
    const capabilities = resolveCrudGenRepositoryCapabilities(repository);
    capabilities.extendedQueries = false;
    expect(declaration.extendedQueries).toBe(true);
    expect(resolveCrudGenRepositoryCapabilities(repository)).toEqual({
      extendedQueries: true,
      structuredGraphqlFilters: false,
    });
  });

  it('retains the legacy method pair and explicit legacy false precedence', () => {
    expect(resolveCrudGenRepositoryCapabilities(extendedMethods())).toEqual({
      extendedQueries: true,
      structuredGraphqlFilters: true,
    });
    expect(
      resolveCrudGenRepositoryCapabilities({
        ...extendedMethods(),
        supportsExtendedRepository: () => false,
      }),
    ).toEqual(PLAIN_CRUD_GEN_REPOSITORY_CAPABILITIES);
    expect(
      resolveCrudGenRepositoryCapabilities({
        supportsExtendedRepository: () => true,
      }),
    ).toEqual({ extendedQueries: true, structuredGraphqlFilters: true });
  });

  it.each([
    {},
    null,
    { getManyExtended: () => [] },
    { getManyAndCountExtended: () => [[], 0] },
  ])('keeps plain and incomplete repositories disabled: %j', (repository) => {
    expect(resolveCrudGenRepositoryCapabilities(repository)).toEqual(
      PLAIN_CRUD_GEN_REPOSITORY_CAPABILITIES,
    );
  });

  it('keeps explicit false on the plain TypeORM execution path', async () => {
    const repository = {
      target: {},
      ...extendedMethods(),
      find: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
      findAndCount: jest
        .fn<() => Promise<[unknown[], number]>>()
        .mockResolvedValue([[], 0]),
      getCrudGenCapabilities: () => ({ extendedQueries: false }),
    };
    const service = new GenericService(repository as any);
    expect(service.supportsExtendedRepository()).toBe(false);
    expect(service.supportsStructuredGraphqlFilters()).toBe(false);
    await expect(
      service.getEntityListExtended({ where: { filters: {} } } as any),
    ).resolves.toEqual([]);
    await expect(service.getEntityListExtended({}, true)).resolves.toEqual([
      [],
      0,
    ]);
    expect(repository.find).toHaveBeenCalledWith({ where: undefined });
    expect(repository.getManyExtended).not.toHaveBeenCalled();
    expect(repository.getManyAndCountExtended).not.toHaveBeenCalled();
  });

  it('delegates both explicit extended execution modes', async () => {
    const repository = {
      target: {},
      ...extendedMethods(),
      getCrudGenCapabilities: () => ({ extendedQueries: true }),
    };
    const service = new GenericService(repository as any);
    await service.getEntityListExtended({});
    await service.getEntityListExtended({}, true);
    expect(repository.getManyExtended).toHaveBeenCalledWith({});
    expect(repository.getManyAndCountExtended).toHaveBeenCalledWith({});
  });

  it.each([
    {},
    { getManyExtended: () => [] },
    { getManyAndCountExtended: () => [[], 0] },
  ])(
    'rejects declared extended support without both methods: %j',
    async (methods) => {
      const service = new GenericService({
        target: {},
        ...methods,
        getCrudGenCapabilities: () => ({ extendedQueries: true }),
      } as any);
      await expect(service.getEntityListExtended({})).rejects.toThrow(
        'does not implement the required extended query methods',
      );
    },
  );

  it('re-resolves capabilities when the service repository changes', () => {
    const service = new GenericService({ target: {} } as any);
    expect(service.supportsExtendedRepository()).toBe(false);
    (service as any).setRepositoryRead({
      target: {},
      ...extendedMethods(),
    } as any);
    expect(service.supportsExtendedRepository()).toBe(true);
  });
});

describe('CrudGen service capability boundary', () => {
  it.each([true, false])(
    'honors independent service filter support %s',
    (enabled) => {
      const fallback = jest.fn(() => !enabled);
      expect(
        supportsCrudGenStructuredGraphqlFilters({
          supportsStructuredGraphqlFilters: () => enabled,
          supportsExtendedRepository: fallback,
        }),
      ).toBe(enabled);
      expect(fallback).not.toHaveBeenCalled();
    },
  );

  it('retains the legacy service fallback without requiring GenericService', () => {
    expect(
      supportsCrudGenStructuredGraphqlFilters({
        supportsExtendedRepository: () => true,
      }),
    ).toBe(true);
    expect(
      supportsCrudGenStructuredGraphqlFilters({
        supportsExtendedRepository: () => false,
      }),
    ).toBe(false);
    expect(
      supportsCrudGenStructuredGraphqlFilters({
        getEntityListExtended: () => [],
      }),
    ).toBe(false);
    expect(
      supportsCrudGenStructuredGraphqlFilters({
        getCrudGenCapabilities: () => ({ structuredGraphqlFilters: true }),
      }),
    ).toBe(false);
  });

  it('recognizes the first-party projection service contract independently of repository inheritance', () => {
    const service = Object.create(ProjectionResourceService.prototype);
    expect(service).not.toBeInstanceOf(GenericService);
    expect(supportsCrudGenStructuredGraphqlFilters(service)).toBe(true);
  });
});
