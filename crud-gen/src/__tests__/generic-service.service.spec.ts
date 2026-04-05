import { jest } from '@jest/globals';
import { importMockedEsm } from '@nestjs-yalc/jest/esm.helper.js';
import * as GenericServiceModule from '../typeorm/generic.service.js';
import { GenericService, GenericServiceFactory } from '../typeorm/generic.service.js';
import {
  BaseEntity,
  Connection,
  Repository,
  getConnection,
  QueryFailedError,
  InsertResult,
  UpdateResult,
  DeleteResult,
} from 'typeorm';
import {
  baseEntityRepository as _baseEntityRepository,
  MockedEntity,
  ReadEntity,
  WriteEntity,
} from '../__mocks__/generic-service.mocks.js';
import { getConnectionName } from '@nestjs-yalc/database/conn.helper.js';
import { createMock } from '@golevelup/ts-jest';
import { CGExtendedRepository } from '../typeorm/generic.repository.js';
import { ConnectionNotFoundError } from 'typeorm';
import { FactoryProvider } from '@nestjs/common';
import {
  CreateEntityError,
  DeleteEntityError,
  UpdateEntityError,
} from '../entity.error.js';
import {
  NoResultsFoundError,
  ConditionsTooBroadError,
} from '../conditions.error.js';
const ClassHelper = await importMockedEsm(
  '@nestjs-yalc/utils/class.helper.js',
  import.meta,
);
jest.mock('typeorm');

describe('GenericService', () => {
  let service: GenericService<MockedEntity>;
  let mockedGetConnection: any;
  let baseEntityRepository = _baseEntityRepository;
  const createTrackedService = () => {
    class TrackedGenericService extends GenericService<BaseEntity> {
      static ctor = jest.fn();
      constructor(
        ...args: ConstructorParameters<typeof GenericService<BaseEntity>>
      ) {
        super(...args);
        TrackedGenericService.ctor(...args);
      }
    }

    return TrackedGenericService;
  };

  beforeEach(async () => {
    mockedGetConnection = jest.mocked(getConnection, true);

    // the target property can't be proxied
    // we need to create a new proxy by overriding the
    // target handled
    baseEntityRepository = new Proxy(baseEntityRepository, {
      get(obj, p) {
        if (p === 'target') return MockedEntity;

        return obj[p];
      },
    });

    service = new GenericService(baseEntityRepository);
    baseEntityRepository.metadata.primaryColumns = [{ propertyName: 'xx' }];
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a service with write repository', () => {
    const writeRepo = new CGExtendedRepository();
    service = new GenericService(baseEntityRepository, writeRepo);
    expect(service.getRepository() === baseEntityRepository).toBeTruthy();
    expect(service.getRepositoryWrite() === writeRepo).toBeTruthy();
  });

  it('should set all repositories correctly', () => {
    const writeRepo = new CGExtendedRepository();
    service.setRepository(writeRepo);
    expect(service.getRepository() === writeRepo).toBeTruthy();
    expect(service.getRepositoryWrite() === writeRepo).toBeTruthy();
  });

  it.skip('should call the factory function properly', () => {
    const TrackedGenericService = createTrackedService();

    const result: FactoryProvider = GenericServiceFactory<BaseEntity>(
      () => BaseEntity,
      'fakeConnection',
      TrackedGenericService as any,
    );
    expect(result).toBeDefined();
    expect(result.useFactory()).toBeInstanceOf(TrackedGenericService);

    expect(TrackedGenericService.ctor).toHaveBeenCalledTimes(1);
  });

  it.skip('should call the factory function properly with parameters', () => {
    const TrackedGenericService = createTrackedService();

    const result: FactoryProvider = GenericServiceFactory<BaseEntity>(
      () => BaseEntity,
      'fakeConnection',
      TrackedGenericService as any,
      MockedEntity,
      'fakeWriteConnection',
    );
    expect(result).toBeDefined();
    expect(result.useFactory()).toBeInstanceOf(TrackedGenericService);

    expect(TrackedGenericService.ctor).toHaveBeenCalledTimes(1);
  });

  it.skip('Check GenericServiceFactory provide object to work properly ', () => {
    const TrackedGenericService = createTrackedService();

    const result: FactoryProvider = GenericServiceFactory<BaseEntity>(
      BaseEntity,
      'fakeConnection',
      TrackedGenericService as any,
    );

    expect(result).toBeDefined();
    expect(result.provide).toEqual('BaseEntityGenericService');
    expect(result.useFactory()).toBeInstanceOf(TrackedGenericService);
    expect(TrackedGenericService.ctor).toHaveBeenCalledTimes(1);
  });

  it('Should GenericServiceFactory works properly with default values ', () => {
    const result: FactoryProvider = GenericServiceFactory<BaseEntity>(
      'BaseEntity' as any,
      'fakeConnection',
    );

    expect(result).toBeDefined();
  });

  it('Check getServiceToken', () => {
    const serviceToken = GenericServiceModule.getServiceToken(BaseEntity);
    expect(serviceToken).toEqual('BaseEntityGenericService');
  });

  it('Check getEntity', async () => {
    const spiedGetEntity = jest.spyOn(service, 'getEntity');
    await service.getEntity('', undefined, undefined, undefined, {
      failOnNull: false,
    });
    expect(baseEntityRepository.findOne).toHaveBeenCalledTimes(1);
    spiedGetEntity.mockClear();
  });

  it('Check getEntity', async () => {
    const spiedGetEntity = jest.spyOn(service, 'getEntity');
    await service.getEntityOrFail('');
    expect(baseEntityRepository.findOneOrFail).toHaveBeenCalledTimes(1);
    spiedGetEntity.mockClear();
  });

  it.skip('Check getEntity with relations', async () => {
    const spiedGetEntity = jest.spyOn(service, 'getEntity');
    expect(spiedGetEntity).not.toHaveBeenCalled();
    await service.getEntity({}, [], ['RelatedEntity']);
    expect(baseEntityRepository.findOne).toBeCalledWith({
      where: {},
      select: [],
      relations: ['RelatedEntity'],
    });
    spiedGetEntity.mockClear();
  });

  it.skip('Check getEntity with specific Database', async () => {
    const testRepository = createMock<Repository<BaseEntity>>();
    const mockedConnection = createMock<Connection>();
    mockedConnection.getRepository.mockReturnValue(testRepository);
    mockedGetConnection.mockReturnValueOnce(mockedConnection);

    const mockedEntity = new BaseEntity();
    testRepository.findOne.mockResolvedValue(mockedEntity);

    // Checks the base repository to be set before changing it
    expect(service.getRepository()).toBe(baseEntityRepository);
    expect(service.getRepositoryWrite()).toBe(baseEntityRepository);

    const entity = await service.getEntity(
      '',
      undefined,
      undefined,
      'databaseName',
    );

    expect(mockedConnection.getRepository).toHaveBeenCalledWith(
      baseEntityRepository.target,
    );
    expect(mockedGetConnection).toHaveBeenCalledWith(
      getConnectionName('databaseName'),
    );
    expect(service.getRepository()).toBe(testRepository);
    expect(service.getRepositoryWrite()).toBe(testRepository);
    expect(entity).toBe(mockedEntity);
  });

  it('Check getEntityList', async () => {
    const mockedList: BaseEntity[] = [new BaseEntity()];
    const spiedGetEntityList = jest.spyOn(service, 'getEntityList');
    baseEntityRepository.find.mockResolvedValue(mockedList);
    expect(spiedGetEntityList).not.toHaveBeenCalled();
    const entityList = await service.getEntityList({});
    expect(entityList).toBe(mockedList);
    spiedGetEntityList.mockClear();
  });

  it('Check getEntityList with count', async () => {
    const mockedCountedList: [BaseEntity[], number] = [[new BaseEntity()], 1];
    const spiedGetEntityList = jest.spyOn(service, 'getEntityList');
    baseEntityRepository.findAndCount.mockResolvedValue(mockedCountedList);
    expect(spiedGetEntityList).not.toHaveBeenCalled();
    const entityList = await service.getEntityList({}, true);
    expect(entityList).toBe(mockedCountedList);
    spiedGetEntityList.mockClear();
  });

  it('Check getEntityList with false count', async () => {
    const mockedList: BaseEntity[] = [new BaseEntity()];
    const spiedGetEntityList = jest.spyOn(service, 'getEntityList');
    baseEntityRepository.find.mockResolvedValue(mockedList);
    expect(spiedGetEntityList).not.toHaveBeenCalled();
    const entityList = await service.getEntityList({}, false);
    expect(entityList).toBe(mockedList);
    spiedGetEntityList.mockClear();
  });

  it.skip('Check getEntityList with relations', async () => {
    const mockedList: BaseEntity[] = [new BaseEntity()];
    const spiedGetEntityList = jest.spyOn(service, 'getEntityList');
    baseEntityRepository.find.mockResolvedValue(mockedList);
    expect(spiedGetEntityList).not.toHaveBeenCalled();
    const entityList = await service.getEntityList({}, false, [
      'RelatedEntity',
    ]);
    expect(baseEntityRepository.find).toBeCalledWith({
      relations: ['RelatedEntity'],
    });
    expect(entityList).toBe(mockedList);
    spiedGetEntityList.mockClear();
  });

  it.skip('Check getEntityList with specific Database', async () => {
    const testRepository = createMock<CGExtendedRepository<BaseEntity>>();
    const mockedConnection = createMock<Connection>();
    mockedConnection.getRepository.mockReturnValue(testRepository);
    mockedGetConnection.mockReturnValueOnce(mockedConnection);

    const mockedList: BaseEntity[] = [new BaseEntity()];
    testRepository.find.mockResolvedValue(mockedList);

    // Checks the base repository to be set before changing it
    expect(service.getRepository()).toBe(baseEntityRepository);

    const entityList = await service.getEntityList(
      {},
      false,
      [],
      'databaseName',
    );

    expect(mockedConnection.getRepository).toHaveBeenCalledWith(
      baseEntityRepository.target,
    );
    expect(mockedGetConnection).toHaveBeenCalledWith(
      getConnectionName('databaseName'),
    );
    expect(service.getRepository()).toBe(testRepository);
    expect(entityList).toBe(mockedList);
  });

  it('Should insert an entity correctly', async () => {
    const mockedEntity = new BaseEntity();
    const insertResult = new InsertResult();
    insertResult.identifiers = [{ id: '123' }];

    baseEntityRepository.insert.mockResolvedValueOnce(insertResult);
    baseEntityRepository.getOneExtended.mockResolvedValueOnce(mockedEntity);
    expect(service.createEntity({})).resolves.toBe(mockedEntity);
  });

  it('Should insert an entity correctly with true', async () => {
    const mockedEntity = new BaseEntity();
    const insertResult = new InsertResult();
    insertResult.identifiers = [{ id: '123' }];

    baseEntityRepository.insert.mockResolvedValueOnce(insertResult);
    baseEntityRepository.getOneExtended.mockResolvedValueOnce(mockedEntity);
    const result = await service.createEntity({}, {}, false);
    expect(result).toBe(true);
    baseEntityRepository.insert.mockRestore();
    baseEntityRepository.getOneExtended.mockRestore();
  });

  it('Should insert an entity correctly when entity isClass', async () => {
    const mockedEntity = new BaseEntity();
    const insertResult = new InsertResult();
    insertResult.identifiers = [{ id: '123' }];
    const mockedIsClass = jest
      .spyOn(ClassHelper, 'isClass')
      .mockReturnValue(true);

    baseEntityRepository.insert.mockResolvedValueOnce(insertResult);
    baseEntityRepository.getOneExtended.mockResolvedValueOnce(mockedEntity);
    const result = await service.createEntity({});
    expect(result).toBe(mockedEntity);
    mockedIsClass.mockRestore();
  });

  it('should correctly map entities from read to write', () => {
    const writeRepo = new CGExtendedRepository();
    writeRepo.target = WriteEntity;

    const readRepo = new CGExtendedRepository();
    readRepo.target = ReadEntity;

    const newService = new GenericService<ReadEntity, WriteEntity>(
      readRepo,
      writeRepo,
    );

    const res = newService.mapEntityR2W({
      jsonProperty: 'test',
      noDest: 'test',
      noTransform: '',
    });
    expect(res).toBeDefined();
  });

  it('should correctly map entities from read to write (without mapper)', () => {
    const writeRepo = new CGExtendedRepository();
    writeRepo.target = WriteEntity;

    const readRepo = new CGExtendedRepository();
    readRepo.target = WriteEntity;

    const newService = new GenericService<WriteEntity, WriteEntity>(
      readRepo,
      writeRepo,
    );

    newService.mapEntityR2W({ data: 'test' });
  });

  it('should not map entities from read to write when there are no classes', () => {
    const writeRepo = new CGExtendedRepository();
    writeRepo.target = {};

    const readRepo = new CGExtendedRepository();
    readRepo.target = {};

    const newService = new GenericService<WriteEntity, WriteEntity>(
      readRepo,
      writeRepo,
    );

    newService.mapEntityR2W({ data: 'test' });
  });

  it('Should update an entity correctly', async () => {
    const mockedEntity = new BaseEntity();

    baseEntityRepository.find.mockResolvedValueOnce([mockedEntity]);
    baseEntityRepository.update.mockResolvedValueOnce(new UpdateResult());
    baseEntityRepository.getOneExtended.mockResolvedValueOnce(mockedEntity);

    const result = await service.updateEntity({}, {});
    expect(result).toBe(mockedEntity);
  });

  it('Should update an entity correctly and return true', async () => {
    const mockedEntity = new BaseEntity();

    baseEntityRepository.find.mockResolvedValueOnce([mockedEntity]);
    baseEntityRepository.update.mockResolvedValueOnce(new UpdateResult());
    baseEntityRepository.getOneExtended.mockResolvedValueOnce(mockedEntity);

    await expect(service.updateEntity({}, {}, {}, false)).resolves.toBe(true);
  });

  it('Should update an entity correctly when entity isClass', async () => {
    const mockedEntity = new BaseEntity();
    const mockedIsClass = jest
      .spyOn(ClassHelper, 'isClass')
      .mockReturnValue(true);

    baseEntityRepository.find.mockResolvedValueOnce([mockedEntity]);
    baseEntityRepository.update.mockResolvedValueOnce(new UpdateResult());
    baseEntityRepository.getOneExtended.mockResolvedValueOnce(mockedEntity);
    baseEntityRepository.getId.mockReturnValue({ id: 'id' });

    const result = await service.updateEntity({}, {});
    expect(result).toBeDefined();
    mockedIsClass.mockReset();
  });

  it('should delete an entity correctly', async () => {
    const deleteResult = new DeleteResult();
    deleteResult.affected = 1;

    baseEntityRepository.find.mockResolvedValueOnce([new BaseEntity()]);
    baseEntityRepository.delete.mockResolvedValueOnce(deleteResult);

    const result = await service.deleteEntity({});
    expect(result).toBeTruthy();
  });

  it('should handle an insertion error', async () => {
    baseEntityRepository.insert.mockRejectedValueOnce(
      new QueryFailedError('', [], ''),
    );

    await expect(async () => service.createEntity({})).rejects.toThrow(
      CreateEntityError,
    );
  });

  it('should handle an update error', async () => {
    baseEntityRepository.find.mockResolvedValueOnce([new BaseEntity()]);
    baseEntityRepository.update.mockRejectedValueOnce(
      new QueryFailedError('', [], ''),
    );

    await expect(async () => service.updateEntity({}, {})).rejects.toThrow(
      UpdateEntityError,
    );
  });

  it('should handle a deletion error', async () => {
    baseEntityRepository.find.mockResolvedValueOnce([new BaseEntity()]);
    baseEntityRepository.delete.mockRejectedValueOnce(
      new QueryFailedError('', [], ''),
    );

    await expect(async () => service.deleteEntity({})).rejects.toThrow(
      DeleteEntityError,
    );
  });

  it.skip('should not handle a differnt kind of error', async () => {
    jest.spyOn(service, 'validateConditions').mockImplementation(jest.fn());
    baseEntityRepository.delete.mockRejectedValueOnce(
      new ConnectionNotFoundError('Another Error'),
    );

    await expect(async () => service.deleteEntity({})).rejects.toEqual({});
  });

  it('Tests the conditions validation checks is empty', async () => {
    baseEntityRepository.find.mockResolvedValueOnce([]);

    await expect(async () => service.validateConditions({})).rejects.toThrow(
      NoResultsFoundError,
    );
  });

  it('Checks if the validation works when the conditions return too many results', async () => {
    baseEntityRepository.find.mockResolvedValueOnce([
      new BaseEntity(),
      new BaseEntity(),
    ]);

    await expect(async () => service.validateConditions({})).rejects.toThrow(
      ConditionsTooBroadError,
    );
  });
  it('test getEntityListCrudGen', async () => {
    const mockedList: BaseEntity[] = [new BaseEntity()];
    baseEntityRepository.find.mockResolvedValue(mockedList);
    const entityListCrudGen = await service.getEntityListExtended({});
    expect(entityListCrudGen).toBeDefined();
  });

  it('test getEntityListCrudGen with count', async () => {
    const mockedCountedList: [BaseEntity[], number] = [[new BaseEntity()], 1];
    baseEntityRepository.findAndCount.mockResolvedValue(mockedCountedList);
    await service.getEntityListExtended({}, true);
    expect(baseEntityRepository.getManyAndCountExtended).toBeCalledWith({});
  });

  it('test getEntityListCrudGen with false count', async () => {
    const mockedList: BaseEntity[] = [new BaseEntity()];
    baseEntityRepository.find.mockResolvedValue(mockedList);
    await service.getEntityListExtended({}, false);
    expect(baseEntityRepository.getManyExtended).toBeCalledWith({});
  });

  it('test getEntityListCrudGen with relations', async () => {
    const mockedList: BaseEntity[] = [new BaseEntity()];
    baseEntityRepository.find.mockResolvedValue(mockedList);
    await service.getEntityListExtended({}, false, ['RelatedEntity']);
    expect(baseEntityRepository.getManyExtended).toBeCalledWith({
      relations: ['RelatedEntity'],
    });
  });

  it('should create an entity using fallback repository when extended helpers are missing', async () => {
    const plainRepo: any = {
      target: {},
      metadata: { primaryColumns: [{ propertyName: 'id' }] },
      create: jest.fn((entity: any) => entity),
      insert: jest.fn(),
      findOneOrFail: jest.fn(),
    };

    const insertResult = new InsertResult();
    insertResult.identifiers = [{ id: '123' }];

    const mockedEntity = { id: '123' };

    plainRepo.insert.mockResolvedValueOnce(insertResult);
    plainRepo.findOneOrFail.mockResolvedValueOnce(mockedEntity);

    const plainService = new GenericService<any>(plainRepo);

    const result = await plainService.createEntity({});

    expect(result).toBe(mockedEntity);
    expect(plainRepo.findOneOrFail).toHaveBeenCalledWith({
      where: { id: '123' },
    });
  });

  it('should update an entity using fallback repository when extended helpers are missing', async () => {
    const plainRepo: any = {
      target: {},
      metadata: { primaryColumns: [{ propertyName: 'id' }] },
      find: jest.fn(),
      update: jest.fn(),
      getId: jest.fn(),
      findOneOrFail: jest.fn(),
    };

    const existingEntity = { id: '123' };
    const updatedEntity = { id: '123', updated: true };

    plainRepo.find.mockResolvedValueOnce([existingEntity]);
    plainRepo.update.mockResolvedValueOnce(new UpdateResult());
    plainRepo.getId.mockReturnValueOnce('123');
    plainRepo.findOneOrFail.mockResolvedValueOnce(updatedEntity);

    const plainService = new GenericService<any>(plainRepo);

    const result = await plainService.updateEntity({} as any, {});

    expect(result).toBe(updatedEntity);
    expect(plainRepo.findOneOrFail).toHaveBeenCalledWith({
      where: { id: '123' },
    });
  });

  it('should fallback to TypeORM find in getEntityListExtended when extended helpers are missing', async () => {
    const plainRepo: any = {
      target: {},
      find: jest.fn(),
    };

    const mockedList = [{ id: '1' }];
    plainRepo.find.mockResolvedValueOnce(mockedList);

    const plainService = new GenericService<any>(plainRepo);

    await plainService.getEntityListExtended(
      {
        where: { foo: 'bar' },
        skip: 0,
        take: 10,
      } as any,
      false,
    );

    const callArgs = plainRepo.find.mock.calls[0][0];
    expect(callArgs.where).toEqual({ foo: 'bar' });
    expect(callArgs.skip).toBe(0);
    expect(callArgs.take).toBe(10);
  });

  it('should sanitize fallback where.filters metadata before delegating to TypeORM', async () => {
    const plainRepo: any = {
      target: {},
      find: jest.fn(),
    };

    plainRepo.find.mockResolvedValueOnce([{ id: '1' }]);

    const plainService = new GenericService<any>(plainRepo);

    await plainService.getEntityListExtended(
      {
        where: { foo: 'bar', filters: {} },
        skip: 5,
        take: 5,
      } as any,
      false,
    );

    const callArgs = plainRepo.find.mock.calls[0][0];
    expect(callArgs.where).toEqual({ foo: 'bar' });
    expect(callArgs.skip).toBe(5);
    expect(callArgs.take).toBe(5);
  });

  it('should fallback to findAndCount when withCount is true and extended helpers are missing', async () => {
    const plainRepo: any = {
      target: {},
      findAndCount: jest.fn(),
    };

    const mockedList = [{ id: '1' }];
    const mockedResult: [any[], number] = [mockedList, 1];
    plainRepo.findAndCount.mockResolvedValueOnce(mockedResult);

    const plainService = new GenericService<any>(plainRepo);

    await plainService.getEntityListExtended(
      {
        where: { foo: 'bar' },
        skip: 0,
        take: 1,
      } as any,
      true,
    );

    const callArgs = plainRepo.findAndCount.mock.calls[0][0];
    expect(callArgs.where).toEqual({ foo: 'bar' });
    expect(callArgs.skip).toBe(0);
    expect(callArgs.take).toBe(1);
  });

  it.skip('test getEntityListCrudGen with specific Database', async () => {
    const testRepository = createMock<CGExtendedRepository<BaseEntity>>();
    const mockedConnection = createMock<Connection>();
    mockedConnection.getRepository.mockReturnValue(testRepository);
    mockedGetConnection.mockReturnValueOnce(mockedConnection);

    const mockedList: BaseEntity[] = [new BaseEntity()];
    testRepository.find.mockResolvedValue(mockedList);

    // Checks the base repository to be set before changing it
    expect(service.getRepository()).toBe(baseEntityRepository);

    await service.getEntityListExtended({}, false, [], 'databaseName');

    expect(mockedConnection.getRepository).toHaveBeenCalledWith(
      baseEntityRepository.target,
    );
    expect(mockedGetConnection).toHaveBeenCalledWith(
      getConnectionName('databaseName'),
    );
    expect(service.getRepository()).toBe(testRepository);
  });
});
