import { OmniExternalRefEntity } from './base/omni-external-ref.entity.js';
import { OmniExternalRefService } from './omni-external-ref.service.js';
import {
  omniBackendServiceToken,
  omniScopedBackendProvidersFactory,
} from './omni-scoped.backend.js';

export const omniExternalRefBackendProvidersFactory = (dbConnection: string) =>
  omniScopedBackendProvidersFactory<OmniExternalRefEntity>({
    entityModel: OmniExternalRefEntity,
    dbConnection,
    serviceToken: omniBackendServiceToken(OmniExternalRefService),
    serviceProvider: OmniExternalRefService,
    createService: (repository, scope, options) =>
      new OmniExternalRefService(
        repository,
        scope,
        options.deletion.externalRef,
      ),
  });
