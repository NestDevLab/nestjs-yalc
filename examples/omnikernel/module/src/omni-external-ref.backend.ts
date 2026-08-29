import { getRepositoryToken } from '@nestjs/typeorm';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import { OmniExternalRefEntity } from './base/omni-external-ref.entity.js';
import { OmniExternalRefBindingValidator } from './omni-external-ref-binding.validator.js';
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
    additionalInject: [getRepositoryToken(OmniRecordEntity, dbConnection)],
    createService: (repository, scope, options, recordRepository) =>
      new OmniExternalRefService(
        repository,
        scope,
        options.deletion.externalRef,
        new OmniExternalRefBindingValidator(recordRepository as never, scope),
      ),
  });
