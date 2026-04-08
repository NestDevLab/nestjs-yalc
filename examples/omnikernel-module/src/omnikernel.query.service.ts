import { FactoryProvider } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OmniExternalRefEntity } from './base/omni-external-ref.entity.js';
import { OmniRelationEntity } from './base/omni-relation.entity.js';
import { OmniCollectionEntity } from './omni-collection.entity.js';
import { OmniExternalRefInternalType } from './omni-external-ref-internal-type.enum.js';
import { OmniRelationKind } from './omni-relation-kind.enum.js';
import { OmniRelationStatus } from './omni-relation-status.enum.js';
import { isOmniCollectionRecordKind } from './omni-relation-semantics.js';

export class OmniKernelQueryService {
  constructor(
    protected relationRepository: Repository<OmniRelationEntity>,
    protected externalRefRepository: Repository<OmniExternalRefEntity>,
  ) {}

  async getCollectionMembers(collectionId: string) {
    const relations = await this.relationRepository.find({
      where: {
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
  useFactory: (
    relationRepository: Repository<OmniRelationEntity>,
    externalRefRepository: Repository<OmniExternalRefEntity>,
  ) => new OmniKernelQueryService(relationRepository, externalRefRepository),
  inject: [
    getRepositoryToken(OmniRelationEntity, dbConnection),
    getRepositoryToken(OmniExternalRefEntity, dbConnection),
  ],
});
