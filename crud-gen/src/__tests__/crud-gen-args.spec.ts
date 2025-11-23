import { BaseEntity } from 'typeorm';
import {
  crudGenParamsFactory,
  crudGenParamsNoPaginationFactory,
  ICrudGenParams,
} from '../crud-gen.args.js';
import {
  RowDefaultValues,
  SortDirection,
} from '../crud-gen.enum.js';

class TestEntity extends BaseEntity {
  columnId: number;
}

describe('Crud-gen args', () => {
  it('Should generate crudGen params', async () => {
    const crudGenArgs = crudGenParamsFactory({
      sorting: [{ colId: 'somecol', sort: SortDirection.ASC }],
      filters: {},
    });
    expect(crudGenArgs).toBeDefined();
    const instance = new crudGenArgs();
    expect(instance).toBeDefined();
  });

  it('Should generate crudGen params without sorting', async () => {
    const crudGenArgs = crudGenParamsFactory();
    expect(crudGenArgs).toBeDefined();
    const instance = new crudGenArgs();
    expect(instance.filters).not.toBeDefined();
  });

  it('Should generate crudGen params with with default values on startRow and endRow', async () => {
    const crudGenArgs = crudGenParamsFactory(undefined, TestEntity);
    expect(crudGenArgs).toBeDefined();
    const instance = new crudGenArgs();
    expect(instance.startRow).toBe(RowDefaultValues.START_ROW);
    expect(instance.endRow).toBe(RowDefaultValues.END_ROW);
  });

  it('Should generate crudGen params with with custom values on startRow and endRow', async () => {
    const defaultValues: ICrudGenParams = {
      startRow: 0,
      endRow: 20,
    };
    const crudGenArgs = crudGenParamsFactory(defaultValues, TestEntity);
    expect(crudGenArgs).toBeDefined();
    const instance = new crudGenArgs();
    expect(instance.startRow).toBe(defaultValues.startRow);
    expect(instance.endRow).toBe(defaultValues.endRow);
  });

  it('Should generate crudGen params without pagination', async () => {
    const crudGenArgs = crudGenParamsNoPaginationFactory(
      {
        sorting: [{ colId: 'somecol', sort: SortDirection.ASC }],
        filters: {},
      },
      TestEntity,
    );
    expect(crudGenArgs).toBeDefined();
    const instance = new crudGenArgs();
    expect(instance).toBeDefined();
  });

  it('Should generate crudGen params without pagination and sorting', async () => {
    const crudGenArgs = crudGenParamsNoPaginationFactory();
    expect(crudGenArgs).toBeDefined();
    const instance = new crudGenArgs();
    expect(instance).toBeDefined();
  });
});
