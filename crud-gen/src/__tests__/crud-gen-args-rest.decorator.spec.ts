import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ExecutionContext } from '@nestjs/common';
import {
  mapCrudGenRestParams,
  CGQueryArgs,
  CGQueryArgsNoPagination,
  ApiOkResponsePaginated,
  CrudGenCombineDecorators,
} from '../api-rest/crud-gen-args-rest.decorator.js';
import {
  FilterType,
  GeneralFilters,
  Operators,
  SortDirection,
} from '../crud-gen.enum.js';

const buildCtx = (
  args: any,
  query: Record<string, unknown> = {},
): ExecutionContext =>
  ({
    getArgs: () => args,
    switchToHttp: () => ({
      getRequest: () => ({ query }),
    }),
  }) as unknown as ExecutionContext;

class DummyDto {
  id!: string;
}

describe('crud-gen args rest decorator', () => {
  it('should map params into CrudGenFindManyOptions', () => {
    const ctx = buildCtx({}, {
      startRow: '5',
      endRow: '8',
      sorting: JSON.stringify([{ colId: 'id', sort: SortDirection.DESC }]),
    });

    const result = mapCrudGenRestParams(undefined, ctx);
    expect(result.take).toBe(3);
    expect(result.order?.id).toBe('DESC');
  });

  it('should parse structured REST filters from JSON query params', () => {
    const ctx = buildCtx(
      {},
      {
        filters: JSON.stringify({
          operator: Operators.AND,
          expressions: [
            {
              text: {
                field: 'name',
                filterType: FilterType.TEXT,
                type: GeneralFilters.CONTAINS,
                filter: 'alice',
              },
            },
          ],
        }),
      },
    );

    const result = mapCrudGenRestParams(undefined, ctx);

    expect(result.where?.childExpressions?.[0]?.filters?.name).toBeDefined();
  });

  it('should map flat query params into equality filters', () => {
    const ctx = buildCtx({}, { projectId: 'project-1' });

    const result = mapCrudGenRestParams(undefined, ctx);

    expect(result.where?.filters?.projectId).toBeDefined();
  });

  it('should keep flat equality filters alongside structured REST params', () => {
    const ctx = buildCtx(
      {},
      {
        sorting: JSON.stringify([{ colId: 'id', sort: SortDirection.ASC }]),
        projectId: 'project-1',
      },
    );

    const result = mapCrudGenRestParams(undefined, ctx);

    expect(result.order?.id).toBe('ASC');
    expect(result.where?.filters?.projectId).toBeDefined();
  });

  it('should reject malformed structured JSON query params', () => {
    const ctx = buildCtx({}, { filters: '{bad-json' });

    expect(() => mapCrudGenRestParams(undefined, ctx)).toThrow(
      BadRequestException,
    );
  });

  it('should reject repeated structured JSON query params', () => {
    const ctx = buildCtx({}, { filters: ['{}', '{}'] });

    expect(() => mapCrudGenRestParams(undefined, ctx)).toThrow(
      BadRequestException,
    );
  });

  it('should reject invalid numeric pagination query params', () => {
    const ctx = buildCtx({}, { startRow: 'not-a-number' });

    expect(() => mapCrudGenRestParams(undefined, ctx)).toThrow(
      BadRequestException,
    );
  });

  it('should build decorators without throwing', () => {
    const target: any = {};
    const descriptor = {};
    const param = 0;

    const decorator = CGQueryArgs({ defaultValue: {}, gql: {} });
    decorator(target, 'handler', param);

    const decoratorNoPag = CGQueryArgsNoPagination({
      defaultValue: {},
      gql: {},
    });
    decoratorNoPag(target, 'handler', param);

    const paginated = ApiOkResponsePaginated(DummyDto);
    const applied = paginated(() => {}) as any;
    expect(applied).toBeUndefined();
  });

  it('should apply extra args decorators and skip hidden ones', async () => {
    const decorator = CrudGenCombineDecorators({
      defaultValue: {},
      extraArgs: {
        visible: { options: { description: 'visible' } },
        hidden: { hidden: true, options: {} },
      },
    } as any);

    expect(() => decorator({}, 'handler', 0)).not.toThrow();
  });
});
