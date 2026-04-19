import { Injectable } from '@nestjs/common';
import { GqlComplexityHelper } from './gql-complexity.helper.js';

@Injectable()
export class GqlComplexityPlugin {
  async requestDidStart() {
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
