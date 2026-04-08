import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers.js';
import {
  OmniRecordCondition,
  OmniRecordCreateInput,
  OmniRecordType,
  OmniRecordUpdateInput,
} from './omni-record.dto.js';
import { OmniRecordEntity } from './base/omni-record.entity.js';

export const omniRecordProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<OmniRecordEntity>({
    entityModel: OmniRecordEntity,
    resolver: {
      dto: OmniRecordType,
      input: {
        create: OmniRecordCreateInput,
        update: OmniRecordUpdateInput,
        conditions: OmniRecordCondition,
      },
      prefix: 'OmniKernel_',
    },
    service: {
      dbConnection,
      entityModel: OmniRecordEntity,
    },
    dataloader: { databaseKey: 'guid' },
  });
