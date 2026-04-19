import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { SelectQueryBuilder } from 'typeorm';
import { ModelField, ModelObject } from '../object.decorator.js';
import '../query-builder.helpers.js';

@ModelObject()
class DerivedEntity {
  @ModelField({ dst: 'computed', mode: 'derived' })
  derived!: string;
}

@ModelObject()
class RegularEntity {
  @ModelField({ mode: 'regular' })
  regular!: string;
}

const escape = (value: string) => `"${value}"`;

const buildQueryBuilder = (raw: any[], entities: any[]) => {
  const qb: any = {
    alias: 'entity',
    connection: { driver: { escape } },
    getRawAndEntities: jest.fn().mockResolvedValue({ raw, entities }),
  };
  Object.setPrototypeOf(qb, SelectQueryBuilder.prototype);
  return qb as SelectQueryBuilder<any>;
};

describe('query-builder helpers', () => {
  let qb: SelectQueryBuilder<any>;

  beforeEach(() => {
    qb = buildQueryBuilder(
      [{ '"entity"_derived': 'computed-value' }],
      [new DerivedEntity()],
    );
  });

  it('getMany should hydrate derived fields from raw result', async () => {
    const result = await qb.getMany();
    expect(result[0].derived).toBe('computed-value');
  });

  it('getMany should return entities unchanged when no model metadata exists', async () => {
    const entity = { value: 'plain' };
    const plainQb = buildQueryBuilder([{}], [entity]);
    const result = await plainQb.getMany();
    expect(result[0]).toBe(entity);
  });

  it('getMany should leave regular model fields unchanged', async () => {
    const entity = new RegularEntity();
    entity.regular = 'regular-value';
    const regularQb = buildQueryBuilder([{}], [entity]);
    const result = await regularQb.getMany();
    expect(result[0].regular).toBe('regular-value');
  });

  it('getOne should return null on empty entities', async () => {
    const emptyQb = buildQueryBuilder([], []);
    const result = await emptyQb.getOne();
    expect(result).toBeNull();
  });

  it('getOne should hydrate derived field on first entity', async () => {
    const result = await qb.getOne();
    expect(result?.derived).toBe('computed-value');
  });

  it('getOne should return the first entity unchanged when no model metadata exists', async () => {
    const entity = { value: 'plain' };
    const plainQb = buildQueryBuilder([{}], [entity]);
    const result = await plainQb.getOne();
    expect(result).toBe(entity);
  });

  it('getOne should leave regular model fields unchanged', async () => {
    const entity = new RegularEntity();
    entity.regular = 'regular-value';
    const regularQb = buildQueryBuilder([{}], [entity]);
    const result = await regularQb.getOne();
    expect(result?.regular).toBe('regular-value');
  });
});
