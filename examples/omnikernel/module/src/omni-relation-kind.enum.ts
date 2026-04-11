import { registerEnumType } from '@nestjs/graphql';

export enum OmniRelationKind {
  Contains = 'contains',
  References = 'references',
  RelatedTo = 'related_to',
  DerivedFrom = 'derived_from',
}

registerEnumType(OmniRelationKind, {
  name: 'OmniRelationKind',
});
