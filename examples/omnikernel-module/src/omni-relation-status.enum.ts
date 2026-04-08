import { registerEnumType } from '@nestjs/graphql';

export enum OmniRelationStatus {
  Active = 'active',
  Inactive = 'inactive',
  Archived = 'archived',
}

registerEnumType(OmniRelationStatus, {
  name: 'OmniRelationStatus',
});
