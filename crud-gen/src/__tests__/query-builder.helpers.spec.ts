import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { SelectQueryBuilder } from 'typeorm';
import { ModelField, ModelObject } from '../object.decorator.js';
import '../query-builder.helpers.js';

@ModelObject()
class DerivedEntity {
  @ModelField({ dst: 'computed', mode: 'derived' })
  derived!: string;
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

  it('getOne should return null on empty entities', async () => {
    const emptyQb = buildQueryBuilder([], []);
    const result = await emptyQb.getOne();
    expect(result).toBeNull();
  });

  it('getOne should hydrate derived field on first entity', async () => {
    const result = await qb.getOne();
    expect(result?.derived).toBe('computed-value');
  });
});
