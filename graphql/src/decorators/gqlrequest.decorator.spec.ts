import { jest } from '@jest/globals';
jest.mock('@nestjs/graphql');

import { GqlGetRequest, paramDecoratorToCreate } from './gqlrequest.decorator.js';
import {
  mockedExecutionContext,
  mockedNestGraphql,
} from '@nestjs-yalc/jest/common-mocks.helper.js';

describe('Gql user decorator test', () => {
  const mockCreate = (mockedNestGraphql.GqlExecutionContext.create = jest.fn());
  mockCreate.mockImplementation(() => ({
    getContext: jest.fn().mockReturnValue({ req: 'valid_req' }),
  }));
  it('Check Module', async () => {
    const testData = GqlGetRequest(null, mockedExecutionContext);
    expect(testData).toBeDefined();
  });

  it('Check the callback function', async () => {
    const testData = paramDecoratorToCreate(null, mockedExecutionContext);
    expect(testData).toBeDefined();
  });
});
