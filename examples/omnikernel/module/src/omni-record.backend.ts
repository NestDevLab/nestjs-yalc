import { OmniRecordEntity } from './base/omni-record.entity.js';
import { omniScopedBackendProvidersFactory } from './omni-scoped.backend.js';
import { OmniScopedService } from './omni-scoped.service.js';

export const omniRecordBackendProvidersFactory = (dbConnection: string) =>
  omniScopedBackendProvidersFactory<OmniRecordEntity>({
    entityModel: OmniRecordEntity,
    dbConnection,
    createService: (repository, scope, options) =>
      new OmniScopedService(repository, scope, options.deletion.record),
  });
