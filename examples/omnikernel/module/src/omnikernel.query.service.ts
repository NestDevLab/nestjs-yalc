import { FactoryProvider, Scope } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OmniExternalRefEntity } from './base/omni-external-ref.entity.js';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import { OmniRelationEntity } from './base/omni-relation.entity.js';
import { OmniCollectionEntity } from './omni-collection.entity.js';
import { OmniExternalRefInternalType } from './omni-external-ref-internal-type.enum.js';
import { OmniRelationKind } from './omni-relation-kind.enum.js';
import { OmniRelationStatus } from './omni-relation-status.enum.js';
import { isOmniCollectionRecordKind } from './omni-relation-semantics.js';
import { OmniScopeContext, type OmniScope } from './omni-scope.js';

const defaultQueryScope: OmniScope = {
  scopeId: 'default',
  cacheKey: (key) => `default:${key}`,
};

export class OmniKernelQueryService {
  constructor(
    protected relationRepository: Repository<OmniRelationEntity>,
    protected externalRefRepository: Repository<OmniExternalRefEntity>,
    protected readonly scope: OmniScope = defaultQueryScope,
  ) {}

  async getCollectionMembers(
    collectionId: string,
  ): Promise<OmniRecordEntity[]> {
    const relations = await this.relationRepository.find({
      where: {
        scopeId: this.scope.scopeId,
        sourceRecordId: collectionId,
        kind: OmniRelationKind.Contains,
        status: OmniRelationStatus.Active,
      },
      relations: {
        targetRecord: true,
      },
      order: {
        createdAt: 'ASC',
      },
    });

    return relations.map((relation) => relation.targetRecord);
  }

  async getDocumentCollections(
    documentId: string,
  ): Promise<OmniCollectionEntity[]> {
    const relations = await this.relationRepository.find({
      where: {
        scopeId: this.scope.scopeId,
        targetRecordId: documentId,
        kind: OmniRelationKind.Contains,
        status: OmniRelationStatus.Active,
      },
      relations: {
        sourceRecord: true,
      },
      order: {
        createdAt: 'ASC',
      },
    });

    return relations
      .map((relation) => relation.sourceRecord)
      .filter(
        (record): record is OmniCollectionEntity =>
          !!record && isOmniCollectionRecordKind(record.kind),
      );
  }

  async getDocumentExternalRefs(documentId: string, provider?: string) {
    return this.externalRefRepository.find({
      where: {
        scopeId: this.scope.scopeId,
        internalType: OmniExternalRefInternalType.Document,
        internalId: documentId,
        ...(provider ? { provider } : {}),
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }
}

export const omniKernelQueryServiceProviderFactory = (
  dbConnection: string,
): FactoryProvider<OmniKernelQueryService> => ({
  provide: OmniKernelQueryService,
  scope: Scope.REQUEST,
  useFactory: (
    relationRepository: Repository<OmniRelationEntity>,
    externalRefRepository: Repository<OmniExternalRefEntity>,
    scope: OmniScope,
  ) =>
    new OmniKernelQueryService(
      relationRepository,
      externalRefRepository,
      scope,
    ),
  inject: [
    getRepositoryToken(OmniRelationEntity, dbConnection),
    getRepositoryToken(OmniExternalRefEntity, dbConnection),
    OmniScopeContext,
  ],
});
