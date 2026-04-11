import { registerEnumType } from '@nestjs/graphql';

export enum OmniCollectionKind {
  Collection = 'collection',
  Folder = 'folder',
}

registerEnumType(OmniCollectionKind, {
  name: 'OmniCollectionKind',
});
