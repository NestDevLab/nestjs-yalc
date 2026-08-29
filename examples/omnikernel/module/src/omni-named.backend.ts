import { OmniNamedEntity } from './base/omni-named.entity.js';
import { omniScopedBackendProvidersFactory } from './omni-scoped.backend.js';
import { OmniScopedService } from './omni-scoped.service.js';

export const omniNamedBackendProvidersFactory = (dbConnection: string) =>
  omniScopedBackendProvidersFactory<OmniNamedEntity>({
    entityModel: OmniNamedEntity,
    dbConnection,
    createService: (repository, scope, options) =>
      new OmniScopedService(repository, scope, options.deletion.named),
  });
