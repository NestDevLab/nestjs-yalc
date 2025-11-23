import * as $ from '../api-graphql/crud-gen-gql.type.js';

class Test {
  testField: string;
}

class TestConnection implements $.IConnectionGql {
  name = '';
  nodes = [];
  pageData = new $.PageDataCrudGenGql();
}

describe('CrudGen Gql type test', () => {
  it('Check creation', async () => {
    const testCrudGenType = $.default<Test>(Test);
    const classed = new testCrudGenType();

    expect(testCrudGenType).toBeDefined();
    expect(classed).toBeDefined();
  });

  it('Check already existing typemap', async () => {
    $.typeMap['Test'] = TestConnection;
    const testCrudGenType = $.default<Test>(Test);

    expect(testCrudGenType).toBeDefined();
    delete $.typeMap['Test'];
  });
});
