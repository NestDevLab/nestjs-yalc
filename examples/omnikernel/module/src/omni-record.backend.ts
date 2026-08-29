import { OmniRecordEntity } from './base/omni-record.entity.js';
import { omniScopedBackendProvidersFactory } from './omni-scoped.backend.js';
import { OmniRecordService } from './omni-record.service.js';

export const omniRecordBackendProvidersFactory = (
  dbConnection: string,
  reservedRecordKinds: readonly string[] = [],
) =>
  omniScopedBackendProvidersFactory<OmniRecordEntity>({
    entityModel: OmniRecordEntity,
    dbConnection,
    createService: (repository, scope, options) =>
      new OmniRecordService(
        repository,
        scope,
        options.deletion.record,
        reservedRecordKinds,
      ),
  });
