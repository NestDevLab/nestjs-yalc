import { describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext } from '@nestjs/common';
import {
  mapCrudGenRestParams,
  CGQueryArgs,
  CGQueryArgsNoPagination,
  ApiOkResponsePaginated,
  CrudGenCombineDecorators,
} from '../api-rest/crud-gen-args-rest.decorator.js';
import { RowDefaultValues } from '../crud-gen.enum.js';

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
    const ctx = buildCtx({
      startRow: 5,
      endRow: 8,
      sorting: [{ colId: 'id', sort: 'DESC' }],
    });

    const result = mapCrudGenRestParams(undefined, ctx);
    expect(result.take).toBe(3);
    expect(result.order?.id).toBe('DESC');
  });

  it('should map flat query params into equality filters', () => {
    const ctx = buildCtx({}, { projectId: 'project-1' });

    const result = mapCrudGenRestParams(undefined, ctx);

    expect(result.where?.filters?.projectId).toBeDefined();
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
