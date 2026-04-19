import {
  expect,
  jest,
  describe,
  it,
  beforeEach,
  beforeAll,
  afterAll,
  afterEach,
} from '@jest/globals';
import {
  BaseEntity,
  Connection,
  FindOperator,
  FindOperatorType,
  QueryRunner,
  SelectQueryBuilder,
} from 'typeorm';
import {
  QueryBuilderHelper,
  ReplicationMode,
} from '../query-builder.helper.js';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';
import { IFieldMapper } from '@nestjs-yalc/interfaces/maps.interface.js';

const dummyFieldMap: IFieldMapper = {
  tag: { dst: 'tag' },
};

const dummyFieldMapDerivedTag: IFieldMapper = {
  tagCount: { dst: 'COUNT(tag)', mode: 'derived', _propertyName: 'tagCount' },
  tag: { dst: 'tag' },
};

const dummyFieldMapDerivedUser: IFieldMapper = {
  guidCount: {
    dst: 'COUNT(guid)',
    mode: 'derived',
    _propertyName: 'guidCount',
  },
  guid: { dst: 'guid' },
};

const fixedKey = 'key';
const fixedAlias = 'alias';
const fixedKeyPrefixed = `\`${fixedAlias}\`.\`${fixedKey}\``;

describe('QueryBuilderHelper', () => {
  let queryBuilderMock: DeepMocked<SelectQueryBuilder<BaseEntity>>;
  beforeEach(() => {
    const mockedQueryRunner = createMock<QueryRunner>({
      release: jest.fn(),
    });
    const mockedConnection = createMock<Connection>({
      driver: {
        isReplicated: false,
        options: {
          type: 'mysql',
        },
      },
      createQueryRunner: jest.fn().mockReturnValue(mockedQueryRunner),
    });
    queryBuilderMock = createMock<SelectQueryBuilder<BaseEntity>>({
      connection: mockedConnection as Connection,
    });
  });

  it('getGroupedManyAndCount works correctly', async () => {
    const groupBy = ['column1', 'column2'];
    const mockedData = [new BaseEntity()];
    const mockedCount = 1;

    const clonedQueryBuilder1: any = {
      groupBy: jest.fn(),
      getMany: jest.fn().mockResolvedValueOnce(mockedData),
    };
    const clonedQueryBuilder2: any = {
      skip: jest.fn(),
      select: jest.fn(),
      orderBy: jest.fn(),
      getRawOne: jest.fn().mockResolvedValueOnce({ count: mockedCount }),
      escape: (v) => v,
    };

    const mockedQueryBuilder: any = {
      clone: jest
        .fn()
        .mockReturnValueOnce(clonedQueryBuilder1)
        .mockReturnValueOnce(clonedQueryBuilder2),
    };

    const result = await QueryBuilderHelper.getGroupedManyAndCount<BaseEntity>(
      mockedQueryBuilder,
      groupBy,
    );

    expect(clonedQueryBuilder1.groupBy).toHaveBeenCalledWith(groupBy.join(', '));
    expect(result).toStrictEqual([mockedData, mockedCount]);
  });

  it('getGroupedManyAndCount fails gracefully for values', async () => {
    const groupBy = ['test'];
    const clonedQueryBuilder1: any = {
      groupBy: jest.fn(),
      getMany: jest.fn().mockRejectedValueOnce(new Error('Error Values')),
    };
    const clonedQueryBuilder2: any = {
      skip: jest.fn(),
      select: jest.fn(),
      orderBy: jest.fn(),
      getRawOne: jest.fn().mockResolvedValueOnce({ count: 0 }),
      escape: (v) => v,
    };

    const mockedQueryBuilder: any = {
      clone: jest
        .fn()
        .mockReturnValueOnce(clonedQueryBuilder1)
        .mockReturnValueOnce(clonedQueryBuilder2),
    };

    await expect(
      QueryBuilderHelper.getGroupedManyAndCount<BaseEntity>(
        mockedQueryBuilder,
        groupBy,
      ),
    ).rejects.toThrow('Error Values');
  });

  it('getGroupedManyAndCount fails gracefully for count', async () => {
    const groupBy = ['test'];
    const clonedQueryBuilder1: any = {
      groupBy: jest.fn(),
      getMany: jest.fn().mockResolvedValueOnce([]),
    };
    const clonedQueryBuilder2: any = {
      skip: jest.fn(),
      select: jest.fn(),
      orderBy: jest.fn(),
      getRawOne: jest.fn().mockRejectedValueOnce(new Error('Error Count')),
      escape: (v) => v,
    };

    const mockedQueryBuilder: any = {
      clone: jest
        .fn()
        .mockReturnValueOnce(clonedQueryBuilder1)
        .mockReturnValueOnce(clonedQueryBuilder2),
    };

    await expect(
      QueryBuilderHelper.getGroupedManyAndCount<BaseEntity>(
        mockedQueryBuilder,
        groupBy,
      ),
    ).rejects.toThrow('Error Count');
  });

  it('should set query runner for replicated connection', async () => {
    const mockedConnection = createMock<Connection>({
      driver: {
        isReplicated: true,
      },
    });
    const mockedQueryBuilder = createMock<SelectQueryBuilder<BaseEntity>>({
      connection: mockedConnection as Connection,
    });

    await QueryBuilderHelper.applyOperationToQueryBuilder(
      mockedQueryBuilder,
      ReplicationMode.SLAVE,
      (qb: SelectQueryBuilder<BaseEntity>) => qb.execute(),
    );

    jest.spyOn(mockedConnection, 'createQueryRunner');
    jest.spyOn(mockedQueryBuilder, 'setQueryRunner');
    jest.spyOn(mockedQueryBuilder, 'execute');

    expect(mockedConnection.createQueryRunner).toHaveBeenCalled();
    expect(mockedQueryBuilder.execute).toHaveBeenCalled();
    expect(mockedQueryBuilder.setQueryRunner).toHaveBeenCalled();
  });

  it('should return operation function result', async () => {
    const mockedQueryRunner = createMock<QueryRunner>({
      release: jest.fn(),
    });

    const mockedConnection = createMock<Connection>({
      driver: {
        isReplicated: false,
      },
      createQueryRunner: jest.fn().mockReturnValue(mockedQueryRunner),
    });

    const mockedQueryBuilder = createMock<SelectQueryBuilder<BaseEntity>>({
      connection: mockedConnection as Connection,
    });
    mockedQueryBuilder.getCount.mockResolvedValue(1);

    const result = await QueryBuilderHelper.applyOperationToQueryBuilder(
      mockedQueryBuilder,
      ReplicationMode.SLAVE,
      (qb: SelectQueryBuilder<BaseEntity>) => qb.getCount(),
    );

    expect(result).toBe(1);
  });

  it('should release the query runner when one is used', async () => {
    const mockedQueryRunner = createMock<QueryRunner>({
      release: jest.fn(),
    });

    const mockedConnection = createMock<Connection>({
      driver: {
        isReplicated: true,
      },
      createQueryRunner: jest.fn().mockReturnValue(mockedQueryRunner),
    });

    const mockedQueryBuilder = createMock<SelectQueryBuilder<BaseEntity>>({
      connection: mockedConnection as Connection,
    });
    mockedQueryBuilder.execute.mockResolvedValue({});

    await QueryBuilderHelper.applyOperationToQueryBuilder(
      mockedQueryBuilder,
      ReplicationMode.SLAVE,
      (qb: SelectQueryBuilder<BaseEntity>) => qb.execute(),
    );

    expect(mockedQueryRunner.release).toHaveBeenCalled();
  });

  it('should return the correct expression for the not type', () => {
    const mockFindOperator = new FindOperator('not', '%crypto%');
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      '%crypto%',
    );
    expect(expression).toEqual("UserTag.tag != '%crypto%'");
  });

  it('should return the correct expression for the data type', () => {
    const today = new Date('01/01/1970');
    const mockFindOperator = new FindOperator('lessThan', today);
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      today,
    );
    expect(expression).toEqual(`UserTag.tag < ${Date.parse(today as any)}`);
  });

  it('should return the correct expression for the data type', () => {
    const mockFindOperator = new FindOperator('not', '%crypto%');
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      "'%crypto%'",
    );
    expect(expression).toEqual("UserTag.tag != '%crypto%'");
  });

  it('should return the correct expression for the not type when there is a child operator present', () => {
    const mockFindOperator = new FindOperator('not', true);
    const parentMockFindOperator = new FindOperator('not', true);
    Object.defineProperty(parentMockFindOperator, 'child', {
      value: mockFindOperator,
      writable: false,
    });
    // parentMockFindOperator.child = mockFindOperator;
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      parentMockFindOperator,
      'UserTag.tag',
      true,
    );
    expect(expression).toEqual('NOT(UserTag.tag != true)');
  });

  it('should return the correct expression for the lessThan type', () => {
    const mockFindOperator = new FindOperator('lessThan', '%crypto%');
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      '%crypto%',
    );
    expect(expression).toEqual("UserTag.tag < '%crypto%'");
  });

  it('should return the correct expression for the lessThanOrEqual type', () => {
    const mockFindOperator = new FindOperator('lessThanOrEqual', '%crypto%');
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      '%crypto%',
    );
    expect(expression).toEqual("UserTag.tag <= '%crypto%'");
  });

  it('should return the correct expression for the moreThan type', () => {
    const mockFindOperator = new FindOperator('moreThan', '%crypto%');
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      '%crypto%',
    );
    expect(expression).toEqual("UserTag.tag > '%crypto%'");
  });

  it('should return the correct expression for the moreThanOrEqual type', () => {
    const mockFindOperator = new FindOperator('moreThanOrEqual', '%crypto%');
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      '%crypto%',
    );
    expect(expression).toEqual("UserTag.tag >= '%crypto%'");
  });

  it('should return the correct expression for the equal type', () => {
    const mockFindOperator = new FindOperator('equal', '%crypto%');
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      '%crypto%',
    );
    expect(expression).toEqual("UserTag.tag = '%crypto%'");
  });

  it('should return the correct expression for the ilike type', () => {
    const mockFindOperator = new FindOperator('ilike', '%crypto%');
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      '%crypto%',
    );
    expect(expression).toEqual("UPPER(UserTag.tag) LIKE UPPER('%crypto%')");
  });

  it('should throw an error for the ilike type without a qb', () => {
    try {
      const mockFindOperator = new FindOperator('ilike', '%crypto%');
      QueryBuilderHelper.computeFindOperatorExpression(
        undefined,
        mockFindOperator,
        'UserTag.tag',
        '%crypto%',
      );
    } catch (error) {
      expect(error).toEqual(
        Error(`To use the 'ilike' filter the query builder should be defined`),
      );
    }
  });
  it('should return the correct expression for the ilike type', () => {
    const mockFindOperator = new FindOperator('ilike', '%crypto%');
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      '%crypto%',
    );
    expect(expression).toEqual("UPPER(UserTag.tag) LIKE UPPER('%crypto%')");
  });

  it('should return the correct expression for the ilike type when the connection is PostgresDriver', () => {
    const mockedQueryRunner = createMock<QueryRunner>({
      release: jest.fn(),
    });
    const mockedConnection = createMock<Connection>({
      driver: {
        options: {
          type: 'postgres',
        },
      },
      createQueryRunner: jest.fn().mockReturnValue(mockedQueryRunner),
    });

    const mockedQueryBuilder = createMock<SelectQueryBuilder<BaseEntity>>({
      connection: mockedConnection as Connection,
    });

    const mockFindOperator = new FindOperator('ilike', '%crypto%');
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      mockedQueryBuilder,
      mockFindOperator,
      'UserTag.tag',
      '%crypto%',
    );
    expect(expression).toEqual("UserTag.tag ILIKE '%crypto%'");
  });

  it('should return the correct expression for the like type', () => {
    const mockFindOperator = new FindOperator('like', '%crypto%');
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      '%crypto%',
    );
    expect(expression).toEqual("UserTag.tag LIKE '%crypto%'");
  });

  it('should return the correct expression for the between type', () => {
    const mockFindOperator = new FindOperator('between', [
      '%firstDate%',
      '%secondDate%',
    ]);
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      ['%firstDate%', '%secondDate%'],
    );
    expect(expression).toEqual(
      "UserTag.tag BETWEEN '%firstDate%' AND '%secondDate%'",
    );
  });

  it('should return the correct expression for the in type', () => {
    const mockFindOperator = new FindOperator('in', [
      '%firstDate%',
      '%secondDate%',
    ]);
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      ['%firstDate%', '%secondDate%'],
    );
    expect(expression).toEqual(
      "UserTag.tag IN ('%firstDate%', '%secondDate%')",
    );
  });

  it('should return the correct expression for the in type when empty params are passed', () => {
    const mockFindOperator = new FindOperator('in', []);
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      [],
    );
    expect(expression).toEqual('0=1');
  });

  it('should return the correct expression for the any type', () => {
    const mockFindOperator = new FindOperator('any', '%crypto%');
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      '%crypto%',
    );
    expect(expression).toEqual("UserTag.tag = ANY('%crypto%')");
  });

  it('should return the correct expression for the isNull type', () => {
    const mockFindOperator = new FindOperator('isNull', '%crypto%');
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      '%crypto%',
    );
    expect(expression).toEqual('UserTag.tag IS NULL');
  });

  it('should return the correct expression for the raw type', () => {
    const mockFindOperator = new FindOperator('raw', '%crypto%');
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      '%crypto%',
    );
    expect(expression).toEqual('UserTag.tag = %crypto%');
  });

  it('should return the correct expression for the raw type', () => {
    const mockFindOperator = new FindOperator(
      'raw',
      '%crypto%',
      false,
      false,
      () => {
        return 'SOMESTRING';
      },
    );
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      '%crypto%',
    );
    expect(expression).toEqual('SOMESTRING');
  });

  it('should throw an error when the type is unsupported', () => {
    expect.assertions(1);
    try {
      const mockFindOperator = new FindOperator(
        'unsupportedType' as FindOperatorType,
        '%crypto%',
      );
      QueryBuilderHelper.computeFindOperatorExpression(
        queryBuilderMock,
        mockFindOperator,
        'UserTag.tag',
        '%crypto%',
      );
    } catch (error) {
      expect(error).toEqual(new TypeError('Unsupported FindOperator Function'));
    }
  });

  it('should return the correct expression for the raw type', () => {
    const mockFindOperator = new FindOperator(
      'raw',
      '%crypto%',
      false,
      false,
      () => {
        return 'SOMESTRING';
      },
    );
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      '%crypto%',
    );
    expect(expression).toEqual('SOMESTRING');
  });

  it('should return the correct type for the args', () => {
    const today = new Date('01/01/1970');
    Date.parse = jest.fn().mockImplementationOnce(() => NaN);
    const mockFindOperator = new FindOperator('lessThan', today);
    const expression = QueryBuilderHelper.computeFindOperatorExpression(
      queryBuilderMock,
      mockFindOperator,
      'UserTag.tag',
      today,
    );
    expect(expression).toEqual(`UserTag.tag < ${today}`);
    Date.parse = jest.fn().mockClear();
  });

  it('should be able to apply an order to a queryBuilder with applyOrderToJoinedQueryBuilder', () => {
    const findOp = new FindOperator('like', '%crypto%', true, false);
    const testData = QueryBuilderHelper.applyOrderToJoinedQueryBuilder(
      {
        where: {
          'UserTag.tag': findOp,
        },
        order: {
          guidCount: 'ASC',
          'UserTag.tagCount': 'ASC',
          'UserTag.tag': 'DESC',
          'UserTag.userId': 'ASC',
          userId: 'ASC',
        },
      },
      'userDynamic',
      { parent: dummyFieldMapDerivedUser, joined: dummyFieldMapDerivedTag },
    );

    expect(testData).toEqual([
      { key: 'UserTag_tagCount', operator: 'ASC' },
      { key: 'UserTag.tag', operator: 'DESC' },
      { key: 'UserTag.userId', operator: 'ASC' },
      { key: 'userDynamic_guidCount', operator: 'ASC' },
      { key: 'userDynamic.userId', operator: 'ASC' },
    ]);

    const testData2 = QueryBuilderHelper.applyOrderToJoinedQueryBuilder(
      {
        order: {
          tagCount: 'ASC',
        },
        extra: {
          _fieldMapper: dummyFieldMapDerivedTag,
        },
      },
      'UserDynamic',
    );

    expect(testData2).toEqual([
      { key: 'UserDynamic_tagCount', operator: 'ASC' },
    ]);
  });

  it('should be able to apply an order to a queryBuilder with applyOrderToJoinedQueryBuilder and name it without the field map', () => {
    const findOp = new FindOperator('like', '%crypto%', true, false);
    const testData = QueryBuilderHelper.applyOrderToJoinedQueryBuilder(
      {
        where: {
          'UserTag.tag': findOp,
        },
        order: {
          userId: 'ASC',
        },
      },
      'userDynamic',
    );
    expect(testData).toEqual([{ key: 'userDynamic.userId', operator: 'ASC' }]);
  });

  it('should be able to work without an order', () => {
    const findOp = new FindOperator('like', '%crypto%', true, false);
    const testData = QueryBuilderHelper.applyOrderToJoinedQueryBuilder(
      {
        where: {
          'UserTag.tag': findOp,
        },
      },
      'userDynamic',
      { parent: dummyFieldMap, joined: dummyFieldMap },
    );
    expect(testData).toEqual([]);
  });

  it('should return the key prefixed with the alias', async () => {
    const result = QueryBuilderHelper.addAlias(
      fixedKey,
      fixedAlias,
      undefined,
      { escapeCharacter: '`' },
    );

    expect(result).toBe(fixedKeyPrefixed);
  });
  it('should return the key', async () => {
    const result = QueryBuilderHelper.addAlias(fixedKey);

    expect(result).toBe(fixedKey);
  });
  it('should return the key prefixed with the alias and the parent', async () => {
    const result = QueryBuilderHelper.addAlias(
      `joined.${fixedKey}`,
      fixedAlias,
      undefined,
      { escapeCharacter: '`' },
    );

    expect(result).toBe(`\`joined\`.\`${fixedKey}\``);
  });
  it('should return the key if is in JSON Raw', async () => {
    const result = QueryBuilderHelper.addAlias(
      `${fixedKey} -> $.fixedKey`,
      fixedAlias,
    );

    expect(result).toBe(`${fixedKey} -> $.fixedKey`);
  });

  it('should return the key prefixed with the alias and the parent using the field mapper', async () => {
    const result = QueryBuilderHelper.addAlias(
      `joined.${fixedKey}`,
      fixedAlias,
      {
        parent: dummyFieldMap,
        joined: dummyFieldMap,
      },
    );

    expect(result).toBe(`joined.${fixedKey}`);
  });

  it('should return the correct field mapper', async () => {
    // const spiedIsFieldMapper = jest.spyOn(MapsInterface, 'isFieldMapper');
    // spiedIsFieldMapper.mockReturnValue(true);
    let result = QueryBuilderHelper.getMapper(
      { parent: dummyFieldMap, joined: dummyFieldMap },
      '',
    );
    expect(result).toEqual(dummyFieldMap);

    result = QueryBuilderHelper.getMapper(
      { parent: dummyFieldMap, joined: { correct: dummyFieldMap } },
      'correct',
    );
    expect(result).toEqual(dummyFieldMap);

    result = QueryBuilderHelper.getMapper(
      { parent: dummyFieldMap, joined: { correct: dummyFieldMap } },
      'wrong',
    );
    expect(result).not.toEqual(dummyFieldMap);
  });
});
