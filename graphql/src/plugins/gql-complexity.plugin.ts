import { Injectable } from '@nestjs/common';
import {
  GraphQLRequestListener,
  ApolloServerPlugin,
} from 'apollo-server-plugin-base';
import { GqlComplexityHelper } from './gql-complexity.helper.js';

@Injectable()
export class GqlComplexityPlugin implements ApolloServerPlugin {
  async requestDidStart(): Promise<GraphQLRequestListener<any>> {
    return {
      async didResolveOperation({
        document,
        schema,
      }: {
        document: any;
        schema: any;
      }) {
        GqlComplexityHelper.processDocumentAST(document, schema);
      },
    };
  }
}
