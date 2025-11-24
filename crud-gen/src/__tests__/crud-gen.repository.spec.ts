import { jest } from '@jest/globals';
import { importMockedEsm } from '@nestjs-yalc/jest/esm.helper.js';
import {
  BaseEntity,
  EntityMetadata,
  FindOptionsUtils,
  SelectQueryBuilder,
} from 'typeorm';
import {
  CGExtendedRepository,
  CGExtendedRepositoryFactory,
} from '../typeorm/generic.repository.js';
import { QueryBuilderHelper } from '@nestjs-yalc/database/query-builder.helper.js';
import { SortDirection } from '../crud-gen.enum.js';
import { DeepMocked } from '@golevelup/ts-jest';
import { Alias } from 'typeorm/query-builder/Alias';
import * as Typeorm from 'typeorm';
const CrudGenHelpers = await importMockedEsm(
  '../crud-gen.helpers.js',
  import.meta,
);

jest.mock('@nestjs-yalc/database/query-builder.helper');
jest.mock('typeorm/find-options/FindOptionsUtils', () => ({
  applyFindManyOptionsOrConditionsToQueryBuilder: jest.fn(),
}));

const fakeFindOptions = {
  take: 5,
  skip: 5,
  where: {
    filters: {
      status: {
        type: 'equal',
        value: 'verified',
        useParameter: true,
        multipleParameters: false,
      },
    },
  } as any,
  extra: {
    rawLimit: true,
  },
};

const fakeFindOptionsWithSubQuery = {
  ...fakeFindOptions,
  extra: {
    rawLimit: true,
  },
  subQueryFilters: {
    filters: {
      status: {
        type: 'equal',
        value: 'verified',
        useParameter: true,
        multipleParameters: false,
      },
    },
  } as any,
};

const fakeFindOptionsExtended = {
  ...fakeFindOptions,
  select: undefined,
  join: {
    innerJoinAndSelect: {
      key: 'key',
    },
    leftJoinAndSelect: {
      key: 'key2',
      key3: 'key3',
    },
  },
  extra: {
    _aliasType: 'aliasType',
    _keysMeta: {
      value: {
        fieldMapper: {
          mode: 'derived',
        },
        isNested: true,
        rawSelect: 'rawSelect',
      },
    },
    _fieldMapper: {
      key: {
        relation: {
          targetKey: {
            dst: 'dst',
          },
          sourceKey: {
            dst: 'dst',
          },
        },
      },
      key2: undefined,
      key3: {
        relation: undefined,
      },
    },
  },
};

const getManyResult = [BaseEntity];

describe('CrudGen Repoository', () => {
  let newCrudGenRepository: CGExtendedRepository<BaseEntity>;
  let mockedQueryBuilder: DeepMocked<SelectQueryBuilder<BaseEntity>>;

  const buildQueryBuilder = () => {
    const qb: any = {
      alias: 'alias',
      connection: {
        driver: { escape: (v: any) => `\`${String(v)}\`` },
        createQueryBuilder: jest.fn(),
      },
      expressionMap: {
        mainAlias: {
          metadata: {
            columns: [{ propertyName: 'status', databaseName: 'status' }],
          },
        },
      },
      setFindOptions: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
    };
    qb.connection.createQueryBuilder.mockReturnValue(qb);
    qb.getCount = jest.fn().mockReturnValue(1);
    qb.getMany = jest.fn().mockReturnValue(getManyResult);
    qb.getManyAndCount = jest.fn().mockReturnValue([getManyResult, 1]);
    qb.getQuery = jest.fn().mockReturnValue('SELECT * FROM fakeTable');
    qb.getOne = jest.fn().mockResolvedValue(BaseEntity);
    qb.getOneOrFail = jest.fn().mockResolvedValue(BaseEntity);
    return qb as DeepMocked<SelectQueryBuilder<BaseEntity>>;
  };

  beforeEach(() => {
    newCrudGenRepository = new CGExtendedRepository();

    mockedQueryBuilder = buildQueryBuilder();

    jest
      .spyOn(newCrudGenRepository, 'createQueryBuilder')
      .mockImplementation(() => mockedQueryBuilder);

    const originalGetFormatted =
      newCrudGenRepository.getFormattedCrudGenQueryBuilder.bind(
        newCrudGenRepository,
      );
    jest
      .spyOn(newCrudGenRepository, 'getFormattedCrudGenQueryBuilder')
      .mockImplementation((findOptions, fieldMap, qb) => {
        const queryBuilder = qb ?? mockedQueryBuilder;
        if (!queryBuilder.connection) {
          (queryBuilder as any).connection = {
            driver: { escape: (v: any) => `\`${String(v)}\`` },
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
          };
        }
        if (!queryBuilder.expressionMap.mainAlias) {
          queryBuilder.expressionMap.mainAlias = {
            metadata: { columns: [{ propertyName: 'status' }] },
          } as any;
        }
        if (!queryBuilder.alias) {
          queryBuilder.alias = 'alias';
        }
        return originalGetFormatted(findOptions, fieldMap, queryBuilder);
      });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('Should be defined', () => {
    expect(newCrudGenRepository).toBeDefined();
  });

  it('getManyCrudGen should work', async () => {
    jest
      .spyOn(newCrudGenRepository, 'getFormattedCrudGenQueryBuilder')
      .mockReturnValueOnce(mockedQueryBuilder);
    const testData = newCrudGenRepository.getManyExtended({});
    await expect(testData).resolves.toEqual(getManyResult);
  });

  it('countCrudGen should work', async () => {
    jest
      .spyOn(newCrudGenRepository, 'getFormattedCrudGenQueryBuilder')
      .mockReturnValueOnce(mockedQueryBuilder);
    const testData = newCrudGenRepository.countExtended({});
    await expect(testData).resolves.toEqual(1);
  });

  it('getManyAndCountCrudGen should work', async () => {
    jest
      .spyOn(newCrudGenRepository, 'getCrudGenQueryBuilder')
      .mockReturnValue(mockedQueryBuilder);

    let testData = await newCrudGenRepository.getManyAndCountExtended({
      take: 100,
    });
    expect(testData).toEqual([getManyResult, getManyResult.length]);

    let findOptions: any = {
      skip: 1,
      take: 3,
      extra: {
        skipCount: true,
      },
    };

    testData = await newCrudGenRepository.getManyAndCountExtended(findOptions);
    expect(testData).toEqual([
      getManyResult,
      getManyResult.length + findOptions.skip,
    ]);

    findOptions = {
      skip: 1,
      take: 3,
      extra: {
        skipCount: true,
      },
      subQueryFilters: {},
    };

    testData = await newCrudGenRepository.getManyAndCountExtended(findOptions);
    expect(testData).toEqual([
      getManyResult,
      getManyResult.length + findOptions.skip,
    ]);

    testData = await newCrudGenRepository.getManyAndCountExtended({
      extra: {
        skipCount: true,
      },
      subQueryFilters: {
        skip: 0,
        take: 1,
      },
    });
    // with skipCount = true
    // we asked for 1 result and received exactly one, it means that
    // we do not know if there are further elements, so it returns -1
    expect(testData).toEqual([getManyResult, -1]);

    testData = await newCrudGenRepository.getManyAndCountExtended({
      extra: { skipCount: false },
    });
    expect(testData).toEqual([getManyResult, getManyResult.length]);
  });

  it('getFormattedCrudGenQueryBuilder should return a queryBuilder', () => {
    jest
      .spyOn(QueryBuilderHelper, 'applyOrderToJoinedQueryBuilder')
      .mockReturnValue([
        {
          key: `Parent.property`,
          operator: SortDirection.ASC,
        },
      ]);

    let testData = newCrudGenRepository.getFormattedCrudGenQueryBuilder(
      {},
      {
        parent: { userId: { dst: 'guid' } },
        joined: { userId: { dst: 'guid' } },
      },
    );
    expect(testData).toEqual(mockedQueryBuilder);

    testData = newCrudGenRepository.getFormattedCrudGenQueryBuilder(
      fakeFindOptions,
      {
        parent: { userId: { dst: 'guid' } },
        joined: { userId: { dst: 'guid' } },
      },
      mockedQueryBuilder,
    );

    expect(testData).toEqual(mockedQueryBuilder);
  });

  it('getCrudGenQueryBuilder should return a queryBuilder with a rawSelection passed', () => {
    jest
      .spyOn(QueryBuilderHelper, 'applyOrderToJoinedQueryBuilder')
      .mockReturnValue([
        {
          key: `Parent.property`,
          operator: SortDirection.ASC,
        },
      ]);

    const testData = newCrudGenRepository.getFormattedCrudGenQueryBuilder(
      { select: ['data -> $.test'] },
      {
        parent: { userId: { dst: 'guid' } },
        joined: { userId: { dst: 'guid' } },
      },
    );
    expect(testData).toEqual(mockedQueryBuilder);
  });

  describe('Check getCrudGenQueryBuilder with the join logic and derived field', () => {
    beforeEach(() => {
      jest
        .spyOn(QueryBuilderHelper, 'applyOrderToJoinedQueryBuilder')
        .mockReturnValue([
          {
            key: `Parent.property`,
            operator: SortDirection.ASC,
          },
        ]);
    });

    it('Should work properly with join and derived mode in findOptions ', () => {
      const testData = newCrudGenRepository.getFormattedCrudGenQueryBuilder(
        fakeFindOptionsExtended,
        {
          parent: { userId: { dst: 'guid' } },
          joined: { userId: { dst: 'guid' } },
        },
      );
      expect(testData).toEqual(mockedQueryBuilder);
    });
    it('Should work properly with undefined field in derived mode in findOptions', () => {
      const tempFindOptions = { ...fakeFindOptionsExtended };

      tempFindOptions.extra._keysMeta.value.isNested = undefined;

      let testData = newCrudGenRepository.getFormattedCrudGenQueryBuilder(
        tempFindOptions,
        {
          parent: { userId: { dst: 'guid' } },
          joined: { userId: { dst: 'guid' } },
        },
      );
      expect(testData).toEqual(mockedQueryBuilder);

      tempFindOptions.extra._keysMeta.value = undefined;

      testData = newCrudGenRepository.getFormattedCrudGenQueryBuilder(
        tempFindOptions,
        {
          parent: { userId: { dst: 'guid' } },
          joined: { userId: { dst: 'guid' } },
        },
      );
      expect(testData).toEqual(mockedQueryBuilder);
    });

    it('Should work properly with undefined in join field', () => {
      const tempFindOptions = { ...fakeFindOptionsExtended };
      tempFindOptions.extra._fieldMapper.key.relation = undefined;
      tempFindOptions.join.innerJoinAndSelect = undefined;

      const testData = newCrudGenRepository.getFormattedCrudGenQueryBuilder(
        tempFindOptions,
        {
          parent: { userId: { dst: 'guid' } },
          joined: { userId: { dst: 'guid' } },
        },
      );
      expect(testData).toEqual(mockedQueryBuilder);
    });
    it('Should work properly with extra field undefined', () => {
      const tempFindOptions = {
        ...fakeFindOptionsExtended,
        extra: undefined,
      };

      const testData = newCrudGenRepository.getFormattedCrudGenQueryBuilder(
        tempFindOptions,
        {
          parent: { userId: { dst: 'guid' } },
          joined: { userId: { dst: 'guid' } },
        },
      );
      expect(testData).toEqual(mockedQueryBuilder);
    });
  });
  it('getCrudGenQueryBuilder should return a queryBuilder', () => {
    jest
      .spyOn(QueryBuilderHelper, 'applyOrderToJoinedQueryBuilder')
      .mockReturnValue([
        {
          key: `Parent.property`,
          operator: SortDirection.ASC,
        },
      ]);

    let testData = newCrudGenRepository.getCrudGenQueryBuilder(
      {
        ...fakeFindOptionsWithSubQuery,
      },
      {
        parent: { userId: { dst: 'guid' } },
        joined: { userId: { dst: 'guid' } },
      },
    );

    expect(testData).toEqual(mockedQueryBuilder);

    const alias = new Alias();
    alias.metadata = {
      columns: [{ propertyName: 'id', databaseName: 'id' }],
    } as any;
    mockedQueryBuilder.expressionMap.mainAlias = alias;

    testData = newCrudGenRepository.getCrudGenQueryBuilder(
      {
        ...fakeFindOptionsWithSubQuery,
      },
      {
        parent: { userId: { dst: 'guid' } },
        joined: { userId: { dst: 'guid' } },
      },
    );

    expect(testData).toEqual(mockedQueryBuilder);

    const newQueryBuilder = buildQueryBuilder();
    newQueryBuilder.expressionMap.mainAlias = alias;
    mockedQueryBuilder.expressionMap.mainAlias = null;
    mockedQueryBuilder.connection.createQueryBuilder = jest
      .fn()
      .mockReturnValue(newQueryBuilder);

    testData = newCrudGenRepository.getCrudGenQueryBuilder(
      {
        ...fakeFindOptionsWithSubQuery,
      },
      {
        parent: { userId: { dst: 'guid' } },
        joined: { userId: { dst: 'guid' } },
      },
    );

    expect(testData).toEqual(newQueryBuilder);
  });

  it('getOneCrudGen should return an entity correctly', async () => {
    jest
      .spyOn(newCrudGenRepository, 'getFormattedCrudGenQueryBuilder')
      .mockReturnValueOnce(mockedQueryBuilder);

    QueryBuilderHelper.applyOperationToQueryBuilder = jest
      .fn()
      .mockImplementation((qb, mode, fn) => {
        fn(qb);
        fn = jest.fn().mockResolvedValue(BaseEntity);
        return fn();
      });

    const result = await newCrudGenRepository.getOneExtended({});
    expect(result).toStrictEqual(BaseEntity);
  });

  it('getOneCrudGen should return an entity correctly with fail', async () => {
    jest
      .spyOn(newCrudGenRepository, 'getFormattedCrudGenQueryBuilder')
      .mockReturnValueOnce(mockedQueryBuilder);

    QueryBuilderHelper.applyOperationToQueryBuilder = jest
      .fn()
      .mockImplementation((qb, mode, fn) => {
        fn(qb);
        fn = jest.fn().mockResolvedValue(BaseEntity);
        return fn();
      });

    const result = await newCrudGenRepository.getOneExtended({}, true);
    expect(result).toStrictEqual(BaseEntity);
  });

  it('CrudGenRepoFactory should return the repo already cached', () => {
    const first = CGExtendedRepositoryFactory<BaseEntity>(BaseEntity);
    const second = CGExtendedRepositoryFactory<BaseEntity>(BaseEntity);

    expect(first).toBeDefined();
    expect(first).toBe(second);
  });

  it('Should check generateFilterOnPrimaryColumn with ids as number', () => {
    const ids = 2;
    Object.defineProperty(newCrudGenRepository, 'metadata', {
      value: {
        primaryColumns: [
          {
            propertyName: 'id',
          },
        ],
      },
    });
    const result = newCrudGenRepository.generateFilterOnPrimaryColumn(ids);
    expect(result).toEqual({
      id: ` = '2'`,
    });
  });

  it('Should check generateFilterOnPrimaryColumn with ids as object', () => {
    const ids = {
      id: '2',
    };
    Object.defineProperty(newCrudGenRepository, 'metadata', {
      value: {
        primaryColumns: [
          {
            propertyName: 'id',
          },
        ],
      },
    });
    const result = newCrudGenRepository.generateFilterOnPrimaryColumn(ids);
    expect(result).toEqual({
      id: ` = '2'`,
    });
  });
  it('Should check genereteSelectOnFind', () => {
    jest.spyOn(CrudGenHelpers, 'objectToFieldMapper').mockReturnValue({});
    jest
      .spyOn(CrudGenHelpers, 'applySelectOnFind')
      .mockImplementation((findOptions, field, fieldMapperField) => {
        findOptions.select = [];
        findOptions.select.push('id');
        findOptions.select.push('data -> $.field');
      });
    newCrudGenRepository.generateSelectOnFind(['id'], BaseEntity);
  });
});
