import { jest } from '@jest/globals';
import { createMock } from '@golevelup/ts-jest';
import { GQLDataLoader } from '@nestjs-yalc/data-loader/dataloader.helper.js';
import { ModuleRef } from '@nestjs/core';
import {
  checkFinalId,
  defineCreateMutation,
  defineDeleteMutation,
  defineFieldResolver,
  defineGetGridResource,
  defineGetSingleResource,
  defineUpdateMutation,
  generateDecorators,
  hasFilters,
  IGenericResolver,
  IGenericResolverMethodOptions,
  IGenericResolverOptions,
  resolverFactory,
} from '../api-graphql/generic.resolver.js';
import returnValue from '@nestjs-yalc/utils/returnValue.js';

import { GenericService } from '../typeorm/generic.service.js';
import {
  TestEntityRelation,
  TestEntityRelation2,
} from '../__mocks__/entity.mock.js';
import * as CrudGenObjectDecorator from '../object.decorator.js';
import * as CrudGenHelpers from '../crud-gen.helpers.js';

import { IModelFieldMetadata } from '../object.decorator.js';
import { BaseEntity } from 'typeorm';
import { CrudGenFindManyOptions } from '../api-graphql/crud-gen-gql.interface.js';
import { FilterType } from '../crud-gen.enum.js';
import { GqlExecutionContext, Query, Resolver } from '@nestjs/graphql';
import { IRelationInfo } from '../crud-gen.helpers.js';

jest.mock('@nestjs/graphql', () => {
  const actual = jest.requireActual('@nestjs/graphql');
  return {
    ...actual,
    GqlExecutionContext: {
      ...actual.GqlExecutionContext,
      create: jest.fn(),
    },
  };
});

class TestEntityDto extends TestEntityRelation {}
class TestEntityInput extends TestEntityDto {}

const propertyRelationName = 'TestEntityRelation2';
const prefix = 'ManageEntity_';
const entityName = 'TestEntityRelation';

const queriesName = {
  getSingleResource: `${prefix}get${entityName}`,
  getGridResource: `${prefix}get${entityName}Grid`,
  create: `${prefix}create${entityName}`,
  update: `${prefix}update${entityName}`,
  delete: `${prefix}delete${entityName}`,
};

const fixedMetadataList: { [key: string]: IModelFieldMetadata } = {
  [propertyRelationName]: {
    //dst: propertyRelationName,
    //src: propertyRelationName,
    gqlType: () => TestEntityDto,
  },
};

const customResolverInfo: IRelationInfo = {
  relation: {
    target: TestEntityRelation,
    propertyName: 'TestEntityRelation2',
    isLazy: false,
    relationType: 'many-to-many',
    type: () => TestEntityRelation2,
    options: {},
  },
  join: {
    target: 'TestEntityRelation2',
    propertyName: 'TestEntityRelation2',
    name: 'TestEntityRelation',
  },
  agField: {
    dst: 'TestEntityRelation2',
    src: 'TestEntityRelation2',
    gqlType: () => undefined,
    gqlOptions: {
      nullable: true,
    },
  },
};

const baseResolverOption: IGenericResolverOptions<TestEntityRelation> = {
  entityModel: TestEntityRelation,
  dto: TestEntityDto,
  prefix: 'ManageEntity_',
  input: {
    create: TestEntityInput,
    conditions: TestEntityInput,
    update: TestEntityInput,
  },
  service: {
    serviceToken: 'TestEntityGenericService',
    dataLoaderToken: 'TestEntityDataLoader',
  },
  queries: {
    getResource: {
      throwOnNotFound: false,
      returnType: () => () => TestEntityRelation,
      idName: 'ID',
    },
    getResourceGrid: {
      returnType: () => () => TestEntityRelation,
    },
  },
  mutations: {
    createResource: {
      returnType: () => () => TestEntityRelation,
    },
    updateResource: {
      returnType: () => () => TestEntityRelation,
    },
    deleteResource: {
      returnType: () => () => TestEntityRelation,
    },
  },
  //readonly: true,
};

const baseResolverOptionNoPrefix = {
  ...baseResolverOption,
  prefix: undefined,
};

let extraResolverOptions: IGenericResolverOptions<TestEntityRelation> = {
  ...baseResolverOption,
  queries: {
    ...baseResolverOption.queries,
    getResource: {
      ...baseResolverOption.queries.getResourceGrid,
      idName: {
        name: 'guid',
        hidden: true,
        filterMiddleware: () => {
          return 'ID';
        },
      },
    },
  },
  mutations: {
    ...baseResolverOption.mutations,
    createResource: {
      ...baseResolverOption.mutations.createResource,
      extraInputs: {
        guid: {
          gqlOptions: {
            type: returnValue(String),
            name: 'guid',
            nullable: true,
          },
          middleware: (_ctx, input) => {
            input.id = 1;
          },
        },
      },
    },
  },
};

let partialExtraResolverOptions: IGenericResolverOptions<TestEntityRelation> = {
  ...baseResolverOption,
  queries: {
    ...baseResolverOption.queries,
    getResource: {
      ...baseResolverOption.queries.getResourceGrid,
      idName: {
        name: 'guid',
        hidden: true,
      },
    },
  },
  mutations: {
    ...baseResolverOption.mutations,
    createResource: {
      ...baseResolverOption.mutations.createResource,
      extraInputs: {
        guid: {
          gqlOptions: {
            type: returnValue(String),
            name: 'guid',
            nullable: true,
          },
        },
      },
    },
  },
};

let missingExtraResolverOptions: IGenericResolverOptions<TestEntityRelation> = {
  ...baseResolverOption,
  queries: {
    ...baseResolverOption.queries,
    getResource: {
      ...baseResolverOption.queries.getResourceGrid,
      idName: {
        name: 'guid',
        hidden: false,
        filterMiddleware: () => {
          return undefined;
        },
      },
    },
  },
  mutations: {
    ...baseResolverOption.mutations,
    createResource: {
      ...baseResolverOption.mutations.createResource,
      extraInputs: {
        guid: {},
      },
    },
  },
};

let undefinedExtraResolverOptions: IGenericResolverOptions<TestEntityRelation> =
  {
    ...baseResolverOption,
    queries: {
      ...baseResolverOption.queries,
      getResource: {
        ...baseResolverOption.queries.getResourceGrid,
        idName: {
          hidden: true,
        },
      },
    },
    mutations: {
      ...baseResolverOption.mutations,
      createResource: {
        ...baseResolverOption.mutations.createResource,
        extraInputs: {
          guid: {},
        },
      },
    },
  };

const mockedResponse = {};

describe('Generic Resolver', () => {
  const mockedGenericService = createMock<GenericService<TestEntityRelation>>();
  const mockedTestEntityRelationDL =
    createMock<GQLDataLoader<TestEntityRelation>>();
  const mockedTestEntityRelation2DL =
    createMock<GQLDataLoader<TestEntityRelation2>>();
  const mockedModuleRef = createMock<ModuleRef>();

  const spiedCrudGenMetaDataList = jest.spyOn(
    CrudGenObjectDecorator,
    'getModelFieldMetadataList',
  );

  const generateResolver = (mockedMetadataList, resolverOption) => {
    spiedCrudGenMetaDataList.mockReturnValue(mockedMetadataList);
    const ResolverClass = resolverFactory<TestEntityRelation>(resolverOption);

    const resolver: IGenericResolver = new ResolverClass(
      mockedGenericService,
      mockedTestEntityRelationDL,
      mockedModuleRef,
    );
    return resolver;
  };

  const getQueriesFromResolver = (resolver) => {
    return {
      getSingleRes: () => resolver[queriesName.getSingleResource]({}, {}, 'id'),
      getGridResource: () => resolver[queriesName.getGridResource]({}),
      create: () => resolver[queriesName.create](TestEntityRelation),
      update: () =>
        resolver[queriesName.update](TestEntityRelation, TestEntityRelation),
      delete: () => resolver[queriesName.delete]('id', {}),
    };
  };
  beforeEach(() => {
    mockedModuleRef.resolve.mockResolvedValue(mockedTestEntityRelation2DL);
    mockedTestEntityRelation2DL.getSearchKey.mockReturnValue('id');
    mockedTestEntityRelation2DL.loadOneToMany.mockResolvedValue([
      [new TestEntityRelation2()],
      1,
    ]);

    mockedModuleRef.resolve.mockResolvedValue(mockedTestEntityRelation2DL);
    mockedTestEntityRelation2DL.loadOne.mockResolvedValue(
      new TestEntityRelation2(),
    );

    mockedTestEntityRelationDL.loadOne.mockResolvedValue(
      new TestEntityRelation(),
    );
    mockedTestEntityRelationDL.loadOneToMany.mockResolvedValue([
      [new TestEntityRelation()],
      1,
    ]);
    mockedGenericService.createEntity.mockResolvedValue(
      new TestEntityRelation(),
    );

    mockedGenericService.getEntityListExtended.mockResolvedValue([
      [new TestEntityRelation()],
      1,
    ]);
    mockedGenericService.updateEntity.mockResolvedValue(
      new TestEntityRelation(),
    );
    mockedGenericService.deleteEntity.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    baseResolverOption,
    extraResolverOptions,
    partialExtraResolverOptions,
    undefinedExtraResolverOptions,
  ])(
    'Should create a resolver with a proper execution of the queries',
    async (resolverOption) => {
      GqlExecutionContext.create = jest.fn().mockImplementation(() => ({
        getContext: jest.fn().mockReturnValue({ response: mockedResponse }),
      }));
      const resolver = generateResolver(fixedMetadataList, resolverOption);
      expect(resolver).toBeDefined();
      const queries = getQueriesFromResolver(resolver);
      expect(await queries.getSingleRes()).toBeInstanceOf(TestEntityRelation);
      expect((await queries.getGridResource())[0][0]).toBeInstanceOf(
        TestEntityRelation,
      );
      expect(await queries.create()).toBeInstanceOf(TestEntityRelation);
      expect(await queries.update()).toBeInstanceOf(TestEntityRelation);
      expect(await queries.delete()).toBe(true);
    },
  );

  it('Should create a resolver with a proper execution of the queries', async () => {
    const resolver = generateResolver(
      fixedMetadataList,
      missingExtraResolverOptions,
    );
    expect(resolver).toBeDefined();
    const queries = getQueriesFromResolver(resolver);
    expect(() => queries.getSingleRes()).rejects.toThrowError();
  });

  it('Should create a resolver with a proper execution of the queries (without prefix)', async () => {
    const resolver = generateResolver(
      fixedMetadataList,
      baseResolverOptionNoPrefix,
    );
    expect(resolver).toBeDefined();
  });

  it('Should create a resolver with the default options', async () => {
    GqlExecutionContext.create = jest.fn().mockImplementation(() => ({
      getContext: jest.fn().mockReturnValue({ response: mockedResponse }),
    }));
    const defaultResolverOption: IGenericResolverOptions<TestEntityRelation> = {
      ...baseResolverOption,
      dto: undefined,
      service: undefined,
      mutations: undefined,
      queries: undefined,
      input: undefined,
    };

    const resolver = generateResolver(undefined, defaultResolverOption);
    expect(resolver).toBeDefined();
    const queries = getQueriesFromResolver(resolver);
    expect(await queries.getSingleRes()).toBeInstanceOf(TestEntityRelation);
    expect((await queries.getGridResource())[0][0]).toBeInstanceOf(
      TestEntityRelation,
    );
    expect(await queries.create()).toBeInstanceOf(TestEntityRelation);
    expect(await queries.update()).toBeInstanceOf(TestEntityRelation);
    expect(await queries.delete()).toBe(true);
  });

  describe('Check dataloader one-to-many relationship', () => {
    let customMetadatList: { [key: string]: IModelFieldMetadata };
    let mockedResolverInfoList: jest.SpyInstance;
    const oneToManyResolverInfo: IRelationInfo = {
      ...customResolverInfo,
      relation: {
        ...customResolverInfo.relation,
        relationType: 'one-to-many',
      },
    };
    beforeEach(() => {
      customMetadatList = { ...fixedMetadataList };
      customMetadatList[propertyRelationName].relation = {
        relationType: 'one-to-many',
        sourceKey: {
          dst: 'sourceKey',
          alias: 'sourceKey',
        },
        targetKey: {
          dst: 'targetKey',
          alias: 'targetKey',
        },
        type: () => String,
      };
      mockedResolverInfoList = jest.spyOn(CrudGenHelpers, 'getEntityRelations');
    });

    afterEach(() => {
      jest.clearAllMocks();
      mockedResolverInfoList.mockClear();
    });

    afterAll(() => {
      jest.restoreAllMocks();
      mockedResolverInfoList.mockRestore();
    });

    it('Should load the entity relationship', async () => {
      const resolveInfo: IRelationInfo = {
        ...oneToManyResolverInfo,
        relation: {
          ...oneToManyResolverInfo.relation,
          relationType: 'one-to-many',
        },
        agField: undefined,
        join: undefined,
      };

      mockedResolverInfoList.mockReturnValue([resolveInfo]);
      const resolver = generateResolver(customMetadatList, baseResolverOption);

      const result = await resolver[propertyRelationName](
        TestEntityRelation2,
        {},
      );

      expect(result[0][0]).toBeInstanceOf(TestEntityRelation2);
    });

    it('Should throw an error with undefined descriptor on the property', () => {
      const spiedGetPropertyDescriptor = jest.spyOn(
        Object,
        'getOwnPropertyDescriptor',
      );
      spiedGetPropertyDescriptor.mockReturnValueOnce(undefined);
      const testFunction = () =>
        generateResolver(customMetadatList, baseResolverOption);
      expect(testFunction).toThrowError();

      // Need to restore the original not-mocked implementation
      spiedGetPropertyDescriptor.mockRestore();
    });
  });

  describe('Check dataloader one-to-one relationship', () => {
    let customMetadatList: { [key: string]: IModelFieldMetadata };
    const oneToOneResolverInfo: IRelationInfo = {
      ...customResolverInfo,
      relation: {
        ...customResolverInfo.relation,
        relationType: 'one-to-one',
      },
    };
    let mockedResolverInfoList: jest.SpyInstance;

    beforeEach(() => {
      customMetadatList = { ...fixedMetadataList };
      customMetadatList[propertyRelationName].relation = {
        relationType: 'one-to-one',
        sourceKey: {
          dst: 'sourceKey',
          alias: 'sourceKey',
        },
        targetKey: {
          dst: 'targetKey',
          alias: 'targetKey',
        },
        type: () => String,
      };
      mockedResolverInfoList = jest.spyOn(CrudGenHelpers, 'getEntityRelations');
    });

    afterEach(() => {
      jest.clearAllMocks();
      mockedResolverInfoList.mockClear();
    });

    afterAll(() => {
      mockedResolverInfoList.mockRestore();
    });

    it('Should load the entity relationship with a one-to-one relationtype', async () => {
      mockedResolverInfoList.mockReturnValueOnce([oneToOneResolverInfo]);
      const resolver = generateResolver(customMetadatList, baseResolverOption);

      const result = await resolver[propertyRelationName](
        TestEntityRelation2,
        {},
      );
      expect(result).toBeInstanceOf(TestEntityRelation2);
    });

    it('Should return nested field if it is already loaded', async () => {
      mockedResolverInfoList.mockReturnValueOnce([oneToOneResolverInfo]);
      const resolver = generateResolver(customMetadatList, baseResolverOption);

      const customEntity = {
        [propertyRelationName]: {},
      };
      const result = await resolver[propertyRelationName](customEntity, {});

      expect(result).toStrictEqual({});
    });

    it('Should load entity relationship with custom values', async () => {
      const resolveInfo: IRelationInfo = {
        ...oneToOneResolverInfo,
        agField: undefined,
        join: undefined,
      };

      mockedResolverInfoList.mockReturnValueOnce([resolveInfo]);

      const resolver = generateResolver(undefined, baseResolverOption);
      await expect(
        resolver[propertyRelationName](TestEntityRelation2, {}),
      ).resolves.toBeDefined();
    });

    it('Should throw an error if we try to load a resolveField with join and resolver specified', async () => {
      mockedResolverInfoList.mockReturnValueOnce([oneToOneResolverInfo]);
      const resolver = generateResolver(customMetadatList, baseResolverOption);
      const customTestEntity = {
        [propertyRelationName]: {},
      };
      const findOptions: CrudGenFindManyOptions = {
        where: {
          filters: {
            ['key']: {},
          },
        },
      };

      await expect(
        resolver[propertyRelationName](customTestEntity as any, findOptions),
      ).rejects.toBeDefined();
    });
  });

  describe('Check dataloader many-to-many relationship', () => {
    let customMetadatList: { [key: string]: IModelFieldMetadata };
    const manyToManyResolverInfo: IRelationInfo = {
      ...customResolverInfo,
      relation: {
        ...customResolverInfo.relation,
        relationType: 'many-to-many',
      },
    };
    const mockedResolverInfoList = jest.spyOn(
      CrudGenHelpers,
      'getEntityRelations',
    );

    beforeEach(() => {
      customMetadatList = { ...fixedMetadataList };
      customMetadatList[propertyRelationName].relation = {
        relationType: 'many-to-many',
        sourceKey: {
          dst: 'sourceKey',
          alias: 'sourceKey',
        },
        targetKey: {
          dst: 'targetKey',
          alias: 'targetKey',
        },
        type: () => String,
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
      mockedResolverInfoList.mockClear();
    });

    afterAll(() => {
      jest.restoreAllMocks();
      mockedResolverInfoList.mockRestore();
    });

    it('Should load the entity relationship with a many-to-many relationtype', async () => {
      mockedResolverInfoList.mockReturnValueOnce([manyToManyResolverInfo]);
      const resolver = generateResolver(customMetadatList, baseResolverOption);

      const result = await resolver[propertyRelationName](
        TestEntityRelation2,
        {},
      );

      expect(result[0][0]).toBeInstanceOf(TestEntityRelation2);
    });

    it('Should return nested field if it is already loaded', async () => {
      mockedResolverInfoList.mockReturnValueOnce([manyToManyResolverInfo]);

      const resolver = generateResolver(customMetadatList, baseResolverOption);

      const customEntity = {
        [propertyRelationName]: {},
      };
      const result = await resolver[propertyRelationName](customEntity, {});

      expect(result).toStrictEqual([{}, -1]);
    });
    it('Should load entity relationship with default values', async () => {
      const resolveInfo: IRelationInfo = {
        ...manyToManyResolverInfo,
        join: undefined,
      };

      mockedResolverInfoList.mockReturnValueOnce([resolveInfo]);
      const resolver = generateResolver({}, baseResolverOption);
      const result = await resolver[propertyRelationName](
        TestEntityRelation2,
        {},
      );
      expect(result).toBeDefined();
    });

    it('Should throw an error if we try to load a resolveField with join and resolver specified', async () => {
      const resolver = generateResolver(customMetadatList, baseResolverOption);
      const customTestEntity = {
        [propertyRelationName]: {},
      };
      const findOptions: CrudGenFindManyOptions = {
        where: {
          filters: {
            ['key']: {},
          },
        },
      };
      try {
        await resolver[propertyRelationName](
          customTestEntity as any,
          findOptions,
        );
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  it('Should not create mutation if it is a read-only resolver', () => {
    const customBaseResolverOption: IGenericResolverOptions<TestEntityRelation> =
      {
        ...baseResolverOption,
        readonly: true,
      };
    const resolver = generateResolver({}, customBaseResolverOption);
    expect(resolver[queriesName.create]).not.toBeDefined();
    expect(resolver[queriesName.delete]).not.toBeDefined();
    expect(resolver[queriesName.update]).not.toBeDefined();
  });

  it('Should create a resolver with custom queries', () => {
    const customBaseResolverOption: IGenericResolverOptions<TestEntityRelation> =
      {
        ...baseResolverOption,
        customQueries: {
          customQuery: {
            isSingleResource: true,
          },
          customQueryGrid: {
            extraArgs: {
              ['date']: {
                filterType: FilterType.DATE,
              } as any,
            },
          },
          customQueryGridNoArgs: {
            extraArgs: undefined,
          },
        },
      };
    const resolver = generateResolver({}, customBaseResolverOption);
    expect(resolver['customQuery']).toBeDefined();
    expect(resolver['customQueryGrid']).toBeDefined();
    expect(resolver['customQueryGridNoArgs']).toBeDefined();
  });

  it('Should throw an error if the queries property has no descriptor', () => {
    const spiedGetPropertyDescriptor = jest.spyOn(
      Object,
      'getOwnPropertyDescriptor',
    );
    spiedCrudGenMetaDataList.mockReturnValue({});
    const ResolverClass =
      resolverFactory<TestEntityRelation>(baseResolverOption);

    spiedGetPropertyDescriptor.mockReturnValue(undefined);
    const testFunction = {
      getSingle: () =>
        defineGetSingleResource('', BaseEntity, ResolverClass, {}),
      getGrid: () => defineGetGridResource('', BaseEntity, ResolverClass, {}),
      create: () =>
        defineCreateMutation('', BaseEntity, ResolverClass, {} as any, {}),
      update: () =>
        defineUpdateMutation('', BaseEntity, ResolverClass, {} as any, {}),
      delete: () =>
        defineDeleteMutation('', BaseEntity, ResolverClass, {} as any, {}),
    };

    expect(testFunction.getSingle).toThrowError();
    expect(testFunction.getGrid).toThrowError();
    expect(testFunction.create).toThrowError();
    expect(testFunction.update).toThrowError();
    expect(testFunction.delete).toThrowError();
    spiedGetPropertyDescriptor.mockRestore();
  });

  it('Should return true of false if findManyOptions has filters', () => {
    const findManyOptions: CrudGenFindManyOptions = {
      order: {
        columnId: 'ASC',
      },
    };

    expect(hasFilters(findManyOptions)).toBeTruthy();

    findManyOptions.where = {
      filters: {},
    };
    findManyOptions.order = undefined;
    expect(hasFilters(findManyOptions)).toBeFalsy();
  });

  it('Should generate decorators properly', () => {
    const result = generateDecorators(Query, 'defaultName', () => BaseEntity, {
      decorators: [],
      queryParams: {
        name: 'defaultName',
      },
    });
    expect(result).toBeDefined();
  });

  it('Should not generate decorators if options resolver are disabled ', () => {
    const result = generateDecorators(Query, 'defaultName', () => BaseEntity, {
      disabled: true,
    });
    expect(result).toStrictEqual([]);
  });

  it('Should generate decorators with default values', () => {
    let options: IGenericResolverMethodOptions = {
      queryParams: undefined,
    };

    let result = generateDecorators(
      Query,
      'defaultName',
      () => BaseEntity,
      options,
    );
    expect(result).toBeDefined();

    options = undefined;
    result = generateDecorators(
      Query,
      'defaultName',
      () => BaseEntity,
      options,
    );
    expect(result).toBeDefined();
  });

  it('Should not override resolverInfo', async () => {
    const resolveInfo: IRelationInfo[] = [
      {
        ...customResolverInfo,
        join: undefined,
      },
    ];
    resolveInfo.findIndex = jest.fn().mockReturnValue(-1);

    const mockedGetEntityRelations = jest
      .spyOn(CrudGenHelpers, 'getEntityRelations')
      .mockReturnValueOnce(resolveInfo);

    const resolver = generateResolver(customResolverInfo, baseResolverOption);
    const result = await resolver[propertyRelationName](
      TestEntityRelation2,
      {},
    );
    expect(result).toBeDefined();
    mockedGetEntityRelations.mockRestore();
  });

  it('Should check if defineFieldResolver call resolveField with nullable true', () => {
    const resolverInfo: IRelationInfo = {
      ...customResolverInfo,
      relation: {
        ...customResolverInfo.relation,
        relationType: 'one-to-one',
      },
    };

    spiedCrudGenMetaDataList.mockReturnValue(fixedMetadataList);
    const ResolverClass =
      resolverFactory<TestEntityRelation>(baseResolverOption);

    defineFieldResolver([resolverInfo], ResolverClass);
  });

  it('Should check if defineFieldResolver handles the relation gqlType withour errors', () => {
    const resolverInfo: IRelationInfo = {
      ...customResolverInfo,
      agField: {
        gqlType: () => [TestEntityRelation2],
      },
      relation: {
        ...customResolverInfo.relation,
        relationType: 'one-to-one',
        type: undefined,
      },
    };

    spiedCrudGenMetaDataList.mockReturnValue(fixedMetadataList);
    const ResolverClass =
      resolverFactory<TestEntityRelation>(baseResolverOption);

    defineFieldResolver([resolverInfo], ResolverClass);
  });

  it('Should throw an error if relType is undefined', () => {
    const resolverInfo: IRelationInfo = {
      ...customResolverInfo,
      agField: undefined,
      relation: {
        ...customResolverInfo.relation,
        relationType: 'one-to-one',
        type: undefined,
      },
    };

    spiedCrudGenMetaDataList.mockReturnValue(fixedMetadataList);
    const ResolverClass =
      resolverFactory<TestEntityRelation>(baseResolverOption);

    expect(() =>
      defineFieldResolver([resolverInfo], ResolverClass),
    ).toThrowError();
  });

  it('Should throw an error if descriptor is not definded in defineFieldResolver', () => {
    const spiedGetPropertyDescriptor = jest.spyOn(
      Object,
      'getOwnPropertyDescriptor',
    );
    spiedGetPropertyDescriptor.mockReturnValue(undefined);

    const resolverInfo: IRelationInfo = {
      ...customResolverInfo,
      relation: {
        ...customResolverInfo.relation,
        relationType: 'many-to-many',
        type: 'RelationType',
      },
    };

    const testFn = () =>
      defineFieldResolver([resolverInfo], {
        prototype: {},
      });
    expect(testFn).toThrowError(
      new ReferenceError(
        `GenericResolver.${propertyRelationName} must have a descriptor`,
      ),
    );

    const resolverInfoOneToOne: IRelationInfo = {
      ...resolverInfo,
      relation: {
        ...resolverInfo.relation,
        relationType: 'one-to-one',
      },
    };
    expect(() =>
      defineFieldResolver([resolverInfoOneToOne], { prototype: {} }),
    ).toThrowError(
      new ReferenceError(
        `GenericResolver.${propertyRelationName} must have a descriptor`,
      ),
    );
    spiedGetPropertyDescriptor.mockRestore();
  });

  it('should throw an error if receive an undefined', () => {
    expect(() => checkFinalId(undefined)).toThrowError();
  });
});
