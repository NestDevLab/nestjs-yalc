import { registerEnumType } from '@nestjs/graphql';

export enum OmniDocumentKind {
  Document = 'document',
  Note = 'note',
  Article = 'article',
  Page = 'page',
}

registerEnumType(OmniDocumentKind, {
  name: 'OmniDocumentKind',
});
