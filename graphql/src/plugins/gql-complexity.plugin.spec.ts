import { jest } from '@jest/globals';
import { GqlComplexityPlugin } from './gql-complexity.plugin.js';
import { GqlComplexityHelper } from './gql-complexity.helper.js';

jest.mock('apollo-server-plugin-base');
jest.mock('./gql-complexity.helper');

describe('GqlComplexityPlugin', () => {
  it('should be defined', () => {
    const plugin = new GqlComplexityPlugin();
    expect(plugin).toBeDefined();
  });

  it('should handle didResolveOperation lifecycle', () => {
    const clonedQueryBuilder: any = {
      document: jest.fn().mockReturnValue({}),
    };

    const plugin = new GqlComplexityPlugin();
    const result = plugin.requestDidStart();

    const spiedFunc = jest.spyOn(GqlComplexityHelper, 'processDocumentAST');
    expect(result.didResolveOperation).toBeDefined();

    result.didResolveOperation(clonedQueryBuilder);
    expect(spiedFunc).toBeCalled();
    expect(spiedFunc).toHaveBeenCalledWith(clonedQueryBuilder.document);
  });
});
