import { describe, expect, it } from '@jest/globals';
import {
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from 'graphql';
import { AppContextService } from '../app-context.service.js';

describe('AppContextService', () => {
  it('should store initialized apps and schema', () => {
    const service = new AppContextService();
    service.initializedApps.add('app1');

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          hello: { type: GraphQLString },
        },
      }),
    });

    service.setSchema(schema);

    expect(service.initializedApps.has('app1')).toBe(true);
    expect(service.schema).toBe(schema);
  });
});
