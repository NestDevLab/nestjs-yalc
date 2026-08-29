import { OmniCollectionEntity } from './omni-collection.entity.js';
import { OmniCollectionService } from './omni-collection.service.js';
import {
  omniBackendServiceToken,
  omniScopedBackendProvidersFactory,
} from './omni-scoped.backend.js';

export const omniCollectionBackendProvidersFactory = (dbConnection: string) =>
  omniScopedBackendProvidersFactory<OmniCollectionEntity>({
    entityModel: OmniCollectionEntity,
    dbConnection,
    serviceToken: omniBackendServiceToken(OmniCollectionService),
    serviceProvider: OmniCollectionService,
    createService: (repository, scope, options) =>
      new OmniCollectionService(repository, scope, options.deletion.collection),
  });
