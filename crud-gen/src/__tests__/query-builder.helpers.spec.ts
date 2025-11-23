import {
  expect,
  describe,
  it,
  beforeEach,
  jest,
} from '@jest/globals';
import { ExtendedBaseEntity } from '@nestjs-yalc/jest/extended-base-entity.entity.js';
import { mockQueryBuilder } from '@nestjs-yalc/jest/common-mocks.helper.js';
const mockGetModelFieldMetadataList = jest.fn();
jest.mock('../object.decorator.js', () => ({
  ...jest.requireActual('../object.decorator.js'),
  getModelFieldMetadataList: mockGetModelFieldMetadataList,
}));
import { SelectQueryBuilderPatched } from '../query-builder.helpers.js';

describe('QueryBuilderHelper', () => {
  let testQb: SelectQueryBuilderPatched<Partial<ExtendedBaseEntity>>;
  const mockedQb = mockQueryBuilder<Partial<ExtendedBaseEntity>>();
  beforeEach(() => {
    mockedQb.expressionMap = {
      clone: () => ({
        mainAlias: undefined,
        aliases: [],
        parameters: {},
        joinedAliases: [],
        parentQueryBuilder: undefined,
      }),
    } as any;
    mockedQb.connection = {
      driver: {
        escape: (value: any) => `"${String(value)}"`,
      },
    } as any;
    testQb = new SelectQueryBuilderPatched<Partial<ExtendedBaseEntity>>(
      mockedQb,
    );

    testQb = new Proxy(testQb, {
      get(obj, p) {
        if (p === 'alias') return false;

        return obj[p];
      },
    });
  });

  it('getMany works correctly', async () => {
    mockGetModelFieldMetadataList.mockReturnValueOnce({
      first: {
        mode: 'derived',
        dst: 'something',
      },
      second: {
        mode: 'derived',
      },
      third: {
        mode: 'regular',
        dst: 'something',
      },
    });
    jest.spyOn(testQb, 'getRawAndEntities').mockResolvedValueOnce({
      entities: [{ first: 'defined', second: 'undefined', third: undefined }],
      raw: [{ first: 'defined', second: 'undefined', third: undefined }],
    });
    let result = await testQb.getMany();
    expect(result).toEqual([
      {
        first: 'defined',
        second: 'undefined',
        third: undefined,
      },
    ]);

    mockGetModelFieldMetadataList.mockReturnValueOnce(undefined);
    jest.spyOn(testQb, 'getRawAndEntities').mockResolvedValueOnce({
      entities: [{ first: 'defined', second: 'undefined', third: undefined }],
      raw: [{ first: 'defined', second: 'undefined', third: undefined }],
    });
    result = await testQb.getMany();
    expect(result).toEqual([
      {
        first: 'defined',
        second: 'undefined',
        third: undefined,
      },
    ]);
  });

  it('getOne works correctly', async () => {
    mockGetModelFieldMetadataList.mockReturnValueOnce({
      first: {
        mode: 'derived',
        dst: 'something',
      },
      second: {
        mode: 'derived',
      },
      third: {
        mode: 'regular',
        dst: 'something',
      },
    });
    jest.spyOn(testQb, 'getRawAndEntities').mockResolvedValueOnce({
      entities: [{ first: 'defined', second: 'undefined', third: undefined }],
      raw: [{ first: 'defined', second: 'undefined', third: undefined }],
    });
    let result = await testQb.getOne();
    expect(result).toEqual({
      first: 'defined',
      second: 'undefined',
      third: undefined,
    });

    mockGetModelFieldMetadataList.mockReturnValueOnce(undefined);
    jest.spyOn(testQb, 'getRawAndEntities').mockResolvedValueOnce({
      entities: [{ first: 'defined', second: 'undefined', third: undefined }],
      raw: [{ first: 'defined', second: 'undefined', third: undefined }],
    });
    result = await testQb.getOne();
    expect(result).toEqual({
      first: 'defined',
      second: 'undefined',
      third: undefined,
    });

    jest.spyOn(testQb, 'getRawAndEntities').mockResolvedValueOnce({
      entities: [],
      raw: [],
    });
    result = await testQb.getOne();
    expect(result).toBeNull();
  });
});
