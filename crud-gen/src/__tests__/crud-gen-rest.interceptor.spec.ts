import { describe, expect, it, jest } from '@jest/globals';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import {
  crudGenRestPaginationInterceptorWorker,
  CrudGenRestPaginationInterceptor,
  buildCrudGenRestSimpleMapperInterceptor,
  buildCrudGenRestMapperInterceptor,
  buildPaginatedResultDto,
  buildPaginatedDTOInterceptor,
  buildDTOInterceptor,
} from '../api-rest/crud-gen-rest.interceptor.js';
import { crudRestControllerFactory } from '../api-rest/crud-gen-rest.controller.factory.js';
import { GenericService } from '../typeorm/generic.service.js';

class TestEntity {
  constructor(
    public id: string,
    public name: string,
  ) {}
}

class TestDto {
  id!: string;
  name!: string;

  constructor(data: { id: string; name: string }) {
    Object.assign(this, data);
  }
}

const buildHttpContext = (query: any = {}, body: any = {}) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        query,
        body,
      }),
    }),
  }) as unknown as ExecutionContext;

describe('crud-gen REST interceptors', () => {
  it('crudGenRestPaginationInterceptorWorker should wrap page data', () => {
    const result = crudGenRestPaginationInterceptorWorker<number>(2, 4)([
      [1, 2],
      10,
    ] as any);

    expect(result).toEqual({
      list: [1, 2],
      pageData: { count: 10, startRow: 2, endRow: 4 },
    });
  });

  it('CrudGenRestPaginationInterceptor should read pagination params from request', async () => {
    const interceptor = new CrudGenRestPaginationInterceptor();
    const ctx = buildHttpContext({ startRow: 5, endRow: 8 });
    const next: CallHandler = {
      handle: () => of([['a'], 3]),
    };

    const result = await firstValueFrom(interceptor.intercept(ctx, next));
    expect(result).toEqual({
      list: ['a'],
      pageData: { count: 3, startRow: 5, endRow: 8 },
    });
  });

  it('CrudGenRestPaginationInterceptor should default to count when no pagination params', async () => {
    const interceptor = new CrudGenRestPaginationInterceptor();
    const ctx = buildHttpContext({});
    const next: CallHandler = {
      handle: () => of([['b'], 1]),
    };

    const result = await firstValueFrom(interceptor.intercept(ctx, next));
    expect(result.pageData).toEqual({ count: 1, startRow: 0, endRow: 1 });
  });

  it('buildCrudGenRestMapperInterceptor should map paginated and non-paginated payloads', async () => {
    const PaginatedInterceptor = buildCrudGenRestMapperInterceptor(
      { id: 'id', name: 'name' } as any,
      true,
    );
    const paginatedInterceptor = new PaginatedInterceptor();
    const ctx = buildHttpContext();
    const paginatedNext: CallHandler = {
      handle: () =>
        of([
          [
            { id: '1', name: 'first' },
            { id: '2', name: 'second' },
          ],
          2,
        ] as any),
    };

    const [mapped, count] = await firstValueFrom(
      paginatedInterceptor.intercept(ctx, paginatedNext),
    );
    expect(mapped[0]).toEqual({ id: '1', name: 'first' });
    expect(count).toBe(2);

    const PlainInterceptor = buildCrudGenRestMapperInterceptor(
      { id: 'id', name: 'name' } as any,
    );
    const plainInterceptor = new PlainInterceptor();
    const plainNext: CallHandler = {
      handle: () => of({ id: '3', name: 'third' }),
    };

    const mappedPlain = await firstValueFrom(
      plainInterceptor.intercept(ctx, plainNext),
    );
    expect(mappedPlain).toEqual({ id: '3', name: 'third' });
  });

  it('buildCrudGenRestSimpleMapperInterceptor should map paginated data to DTOs', async () => {
    const Interceptor = buildCrudGenRestSimpleMapperInterceptor(TestDto, true);
    const interceptor = new Interceptor();
    const ctx = buildHttpContext();
    const next: CallHandler = {
      handle: () =>
        of([
          [
            { id: '1', name: 'first' },
            { id: '2', name: 'second' },
          ],
          2,
        ] as any),
    };

    const [items, count] = await firstValueFrom(
      interceptor.intercept(ctx, next),
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toBeInstanceOf(TestDto);
    expect(count).toBe(2);
  });

  it('buildPaginatedResultDto should map list to DTO instances', () => {
    const PaginatedDto = buildPaginatedResultDto(TestDto);
    const page = new PaginatedDto(
      [
        { id: '1', name: 'name' },
        { id: '2', name: 'other' },
      ] as any[],
      { count: 2, startRow: 0, endRow: 2 },
    );

    expect(page.list[0]).toBeInstanceOf(TestDto);
    expect(page.pageData.count).toBe(2);
  });

  it('buildPaginatedDTOInterceptor should wrap DTOs with pagination info', async () => {
    const Interceptor = buildPaginatedDTOInterceptor(TestDto);
    const interceptor = new Interceptor();
    const ctx = buildHttpContext({ startRow: 1, endRow: 3 });
    const next: CallHandler = {
      handle: () =>
        of([
          [
            { id: '1', name: 'one' },
            { id: '2', name: 'two' },
          ],
          5,
        ] as any),
    };

    const result = await firstValueFrom(interceptor.intercept(ctx, next));
    expect(result.list[1]).toBeInstanceOf(TestDto);
    expect(result.pageData).toEqual({ count: 5, startRow: 1, endRow: 3 });
  });

  it('buildDTOInterceptor should convert payload to DTO', async () => {
    const Interceptor = buildDTOInterceptor(TestDto);
    const interceptor = new Interceptor();
    const ctx = buildHttpContext();
    const next: CallHandler = {
      handle: () => of({ id: 'id', name: 'value' }),
    };

    const result = await firstValueFrom(interceptor.intercept(ctx, next));
    expect(result).toBeInstanceOf(TestDto);
    expect(result.name).toBe('value');
  });
});

describe('crudRestControllerFactory', () => {
  it('should map list and getById using provided service', async () => {
    const service = {
      getEntityListExtended: jest.fn().mockResolvedValue(['ok']),
      getEntity: jest.fn().mockResolvedValue({ id: '1', name: 'entity' }),
      createEntity: jest.fn(),
      updateEntity: jest.fn(),
      deleteEntity: jest.fn(),
    } as unknown as GenericService<TestEntity>;

    const decorators = [
      ((target: any) => {
        target.decorated = true;
      }) as ClassDecorator,
    ];

    const Controller = crudRestControllerFactory<TestEntity>({
      entityModel: TestEntity,
      dto: TestDto,
      decorators,
    });

    expect((Controller as any).decorated).toBe(true);

    const controller = new Controller(service);

    const listResult = await controller.list({} as any);
    expect(service.getEntityListExtended).toHaveBeenCalledWith({}, true);
    expect(listResult).toEqual(['ok']);

    const item = await controller.getById('1');
    expect(service.getEntity).toHaveBeenCalledWith(
      { id: '1' } as any,
      undefined,
      undefined,
      undefined,
      { failOnNull: true },
    );
    expect(item).toBeInstanceOf(TestDto);
    expect(item.name).toBe('entity');
  });

  it('should map create, update and delete to GenericService write methods', async () => {
    const service = {
      getEntityListExtended: jest.fn(),
      getEntity: jest.fn(),
      createEntity: jest.fn().mockResolvedValue({ id: '1', name: 'created' }),
      updateEntity: jest.fn().mockResolvedValue({
        id: '1',
        name: 'updated',
      }),
      deleteEntity: jest.fn().mockResolvedValue(true),
    } as unknown as GenericService<TestEntity>;

    const Controller = crudRestControllerFactory<TestEntity>({
      entityModel: TestEntity,
      dto: TestDto,
    });

    const controller = new Controller(service);

    const created = await controller.create({ name: 'created' } as any);
    expect(service.createEntity).toHaveBeenCalledWith({ name: 'created' });
    expect(created).toBeDefined();

    const updated = await controller.update('1', { name: 'updated' } as any);
    expect(service.updateEntity).toHaveBeenCalledWith(
      { id: '1' } as any,
      { name: 'updated' } as any,
    );
    expect(updated).toBeDefined();

    const removed = await controller.remove('1');
    expect(service.deleteEntity).toHaveBeenCalledWith({ id: '1' } as any);
    expect(removed).toEqual({ deleted: true });
  });
});
