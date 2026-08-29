import { getRepositoryToken } from '@nestjs/typeorm';
import { OmniRelationEntity } from './base/omni-relation.entity.js';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import { createOmniRelationKindContract } from './omni-relation-kind.contract.js';
import { OmniRelationService } from './omni-relation.service.js';
import { omniScopedBackendProvidersFactory } from './omni-scoped.backend.js';

export const omniRelationBackendProvidersFactory = (dbConnection: string) =>
  omniScopedBackendProvidersFactory<OmniRelationEntity>({
    entityModel: OmniRelationEntity,
    dbConnection,
    additionalInject: [getRepositoryToken(OmniRecordEntity, dbConnection)],
    createService: (repository, scope, options, recordRepository) =>
      new OmniRelationService(
        repository,
        scope,
        options.deletion.relation,
        recordRepository as never,
        createOmniRelationKindContract(options.relationKinds),
      ),
  });
