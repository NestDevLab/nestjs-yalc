import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import {
  OmniRecordCondition,
  OmniRecordCreateInput,
  OmniRecordType,
  OmniRecordUpdateInput,
} from './omni-record.dto';
import { OmniRecordEntity } from './base/omni-record.entity';

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
