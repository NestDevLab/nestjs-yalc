import { GenericService } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import type { DeepPartial } from 'typeorm';
import { OmniExternalRefEntity } from './base/omni-external-ref.entity';
import { OmniExternalRefInternalType } from './omni-external-ref-internal-type.enum';

export interface OmniExternalRefLookup {
  provider: string;
  externalId: string;
  account?: string | null;
  container?: string | null;
}

export interface OmniExternalRefSyncInput extends OmniExternalRefLookup {
  payload?: Record<string, unknown> | null;
}

export type OmniExternalRefUpsertInput = Omit<
  DeepPartial<OmniExternalRefEntity>,
  'provider' | 'externalId' | 'internalType' | 'internalId'
> &
  Pick<
    OmniExternalRefEntity,
    'provider' | 'externalId' | 'internalType' | 'internalId'
  >;

export class OmniExternalRefService extends GenericService<OmniExternalRefEntity> {
  async findByExternalIdentity({
    provider,
    externalId,
    account = null,
    container = null,
  }: OmniExternalRefLookup): Promise<OmniExternalRefEntity | null> {
    return this.getRepository().findOne({
      where: {
        provider,
        externalId,
        account,
        container,
      },
    });
  }

  async findForInternalRecord(
    internalType: OmniExternalRefInternalType,
    internalId: string,
    provider?: string,
  ): Promise<OmniExternalRefEntity[]> {
    return this.getRepository().find({
      where: {
        internalType,
        internalId,
        ...(provider ? { provider } : {}),
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async upsertExternalRef(
    input: OmniExternalRefUpsertInput,
  ): Promise<OmniExternalRefEntity> {
    if (input.provider.trim().length === 0) {
      throw new Error('OmniExternalRef.provider is required');
    }

    if (input.externalId.trim().length === 0) {
      throw new Error('OmniExternalRef.externalId is required');
    }

    const existing = await this.findByExternalIdentity({
      provider: input.provider,
      externalId: input.externalId,
      account: input.account ?? null,
      container: input.container ?? null,
    });

    if (existing) {
      return this.updateEntity(
        { guid: existing.guid },
        input,
      ) as Promise<OmniExternalRefEntity>;
    }

    return this.createEntity(input) as Promise<OmniExternalRefEntity>;
  }

  async syncDocumentReference(
    internalId: string,
    input: OmniExternalRefSyncInput,
  ): Promise<OmniExternalRefEntity> {
    return this.upsertExternalRef({
      ...input,
      internalType: OmniExternalRefInternalType.Document,
      internalId,
    });
  }

  async syncCollectionReference(
    internalId: string,
    input: OmniExternalRefSyncInput,
  ): Promise<OmniExternalRefEntity> {
    return this.upsertExternalRef({
      ...input,
      internalType: OmniExternalRefInternalType.Collection,
      internalId,
    });
  }
}
