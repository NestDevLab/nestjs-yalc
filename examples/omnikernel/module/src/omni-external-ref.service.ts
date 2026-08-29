import { ConflictException } from '@nestjs/common';
import type { CrudGenFindManyOptions } from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interface.js';
import type { DeepPartial, FindOptionsWhere } from 'typeorm';
import { OmniExternalRefEntity } from './base/omni-external-ref.entity.js';
import { OmniExternalRefInternalType } from './omni-external-ref-internal-type.enum.js';
import { OmniScopedService } from './omni-scoped.service.js';

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

export class OmniExternalRefService extends OmniScopedService<OmniExternalRefEntity> {
  async findByExternalIdentity({
    provider,
    externalId,
    account = null,
    container = null,
  }: OmniExternalRefLookup): Promise<OmniExternalRefEntity | null> {
    return this.getRepository().findOne({
      where: {
        scopeId: this.scopeId,
        provider,
        externalId,
        account: account ?? '',
        container: container ?? '',
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
        scopeId: this.scopeId,
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
        this.normalizeExternalIdentity(input),
      ) as Promise<OmniExternalRefEntity>;
    }

    return this.createEntity(
      this.normalizeExternalIdentity(input),
    ) as Promise<OmniExternalRefEntity>;
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

  override async createEntity(
    input: DeepPartial<OmniExternalRefEntity>,
    findOptions?: CrudGenFindManyOptions<OmniExternalRefEntity>,
    returnEntity?: true,
  ): Promise<OmniExternalRefEntity>;
  override async createEntity(
    input: DeepPartial<OmniExternalRefEntity>,
    findOptions?: CrudGenFindManyOptions<OmniExternalRefEntity>,
    returnEntity?: boolean,
  ): Promise<OmniExternalRefEntity | boolean>;
  override async createEntity(
    input: DeepPartial<OmniExternalRefEntity>,
    findOptions?: CrudGenFindManyOptions<OmniExternalRefEntity>,
    returnEntity = true,
  ): Promise<OmniExternalRefEntity | boolean> {
    const normalized = this.normalizeExternalIdentity(input);
    this.rejectServerFields(normalized as object);
    if (
      typeof normalized.provider === 'string' &&
      typeof normalized.externalId === 'string'
    ) {
      const existing = await this.findByExternalIdentity({
        provider: normalized.provider,
        externalId: normalized.externalId,
        account: normalized.account ?? null,
        container: normalized.container ?? null,
      });
      if (existing) {
        throw new ConflictException(
          'External reference identity already exists in this scope.',
        );
      }
    }
    return super.createEntity(normalized, findOptions, returnEntity);
  }

  override async updateEntity(
    conditions: FindOptionsWhere<OmniExternalRefEntity>,
    input: DeepPartial<OmniExternalRefEntity>,
    findOptions?: CrudGenFindManyOptions<OmniExternalRefEntity>,
    returnEntity?: true,
  ): Promise<OmniExternalRefEntity>;
  override async updateEntity(
    conditions: FindOptionsWhere<OmniExternalRefEntity>,
    input: DeepPartial<OmniExternalRefEntity>,
    findOptions?: CrudGenFindManyOptions<OmniExternalRefEntity>,
    returnEntity?: boolean,
  ): Promise<OmniExternalRefEntity | boolean>;
  override async updateEntity(
    conditions: FindOptionsWhere<OmniExternalRefEntity>,
    input: DeepPartial<OmniExternalRefEntity>,
    findOptions?: CrudGenFindManyOptions<OmniExternalRefEntity>,
    returnEntity = true,
  ): Promise<OmniExternalRefEntity | boolean> {
    return super.updateEntity(
      conditions,
      this.normalizeExternalIdentity(input),
      findOptions,
      returnEntity,
    );
  }

  private normalizeExternalIdentity<
    T extends DeepPartial<OmniExternalRefEntity>,
  >(input: T): T {
    return {
      ...input,
      ...(Object.prototype.hasOwnProperty.call(input, 'account')
        ? { account: input.account ?? '' }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(input, 'container')
        ? { container: input.container ?? '' }
        : {}),
    };
  }
}
