import { CrudGenDependencyFactory } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import {
  OmniNamedCondition,
  OmniNamedCreateInput,
  OmniNamedType,
  OmniNamedUpdateInput,
} from './omni-named.dto';
import { OmniNamedEntity } from './base/omni-named.entity';

export const omniNamedProvidersFactory = (dbConnection: string) =>
  CrudGenDependencyFactory<OmniNamedEntity>({
    entityModel: OmniNamedEntity,
    resolver: {
      dto: OmniNamedType,
      input: {
        create: OmniNamedCreateInput,
        update: OmniNamedUpdateInput,
        conditions: OmniNamedCondition,
      },
      prefix: 'OmniKernel_',
    },
    service: {
      dbConnection,
      entityModel: OmniNamedEntity,
    },
    dataloader: { databaseKey: 'guid' },
  });
