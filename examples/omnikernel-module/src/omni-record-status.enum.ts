import { registerEnumType } from '@nestjs/graphql';

export enum OmniRecordStatus {
  Draft = 'draft',
  Active = 'active',
  Archived = 'archived',
}

registerEnumType(OmniRecordStatus, {
  name: 'OmniRecordStatus',
});
