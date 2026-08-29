import { OmniDocumentEntity } from './omni-document.entity.js';
import { OmniDocumentService } from './omni-document.service.js';
import {
  omniBackendServiceToken,
  omniScopedBackendProvidersFactory,
} from './omni-scoped.backend.js';

export const omniDocumentBackendProvidersFactory = (dbConnection: string) =>
  omniScopedBackendProvidersFactory<OmniDocumentEntity>({
    entityModel: OmniDocumentEntity,
    dbConnection,
    serviceToken: omniBackendServiceToken(OmniDocumentService),
    serviceProvider: OmniDocumentService,
    createService: (repository, scope, options) =>
      new OmniDocumentService(repository, scope, options.deletion.document),
  });
