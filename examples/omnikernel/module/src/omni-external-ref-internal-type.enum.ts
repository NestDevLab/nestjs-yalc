import { registerEnumType } from '@nestjs/graphql';

export enum OmniExternalRefInternalType {
  Record = 'record',
  Document = 'document',
  Collection = 'collection',
}

registerEnumType(OmniExternalRefInternalType, {
  name: 'OmniExternalRefInternalType',
});
