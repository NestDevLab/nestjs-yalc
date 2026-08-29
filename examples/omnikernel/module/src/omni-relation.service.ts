import { BadRequestException } from '@nestjs/common';
import type { CrudGenFindManyOptions } from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interface.js';
import {
  IsNull,
  type DeepPartial,
  type FindOptionsWhere,
  type Repository,
} from 'typeorm';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import { OmniRelationEntity } from './base/omni-relation.entity.js';
import {
  canonicalOmniRelationKinds,
  type OmniRelationKindContract,
} from './omni-relation-kind.contract.js';
import { isAllowedOmniRelation } from './omni-relation-semantics.js';
import type { OmniDeletePolicy, OmniScope } from './omni-scope.js';
import { OmniScopedService } from './omni-scoped.service.js';

/**
 * Scoped graph CRUD with immutable endpoints. The database composite foreign
 * keys prevent cross-scope edges; this service additionally turns missing or
 * invalid endpoints into normal API failures before persistence.
 */
export class OmniRelationService extends OmniScopedService<OmniRelationEntity> {
  constructor(
    repository: any,
    scope: OmniScope,
    deletion: OmniDeletePolicy,
    private readonly recordRepository: Repository<OmniRecordEntity>,
    private readonly kinds: OmniRelationKindContract,
  ) {
    super(repository, scope, deletion);
  }

  override async createEntity(
    input: DeepPartial<OmniRelationEntity>,
    findOptions?: CrudGenFindManyOptions<OmniRelationEntity>,
    returnEntity?: true,
  ): Promise<OmniRelationEntity>;
  override async createEntity(
    input: DeepPartial<OmniRelationEntity>,
    findOptions?: CrudGenFindManyOptions<OmniRelationEntity>,
    returnEntity?: boolean,
  ): Promise<OmniRelationEntity | boolean>;
  override async createEntity(
    input: DeepPartial<OmniRelationEntity>,
    findOptions?: CrudGenFindManyOptions<OmniRelationEntity>,
    returnEntity = true,
  ): Promise<OmniRelationEntity | boolean> {
    this.rejectServerFields(input as object);
    await this.assertRelation(input);
    return super.createEntity(input, findOptions, returnEntity);
  }

  override async updateEntity(
    conditions: FindOptionsWhere<OmniRelationEntity>,
    input: DeepPartial<OmniRelationEntity>,
    findOptions?: CrudGenFindManyOptions<OmniRelationEntity>,
    returnEntity?: true,
  ): Promise<OmniRelationEntity>;
  override async updateEntity(
    conditions: FindOptionsWhere<OmniRelationEntity>,
    input: DeepPartial<OmniRelationEntity>,
    findOptions?: CrudGenFindManyOptions<OmniRelationEntity>,
    returnEntity?: boolean,
  ): Promise<OmniRelationEntity | boolean>;
  override async updateEntity(
    conditions: FindOptionsWhere<OmniRelationEntity>,
    input: DeepPartial<OmniRelationEntity>,
    findOptions?: CrudGenFindManyOptions<OmniRelationEntity>,
    returnEntity = true,
  ): Promise<OmniRelationEntity | boolean> {
    for (const field of ['guid', 'sourceRecordId', 'targetRecordId']) {
      if (Object.prototype.hasOwnProperty.call(input, field)) {
        throw new BadRequestException(`Omni relation ${field} is immutable.`);
      }
    }

    const current = await this.getEntity(
      conditions,
      undefined,
      undefined,
      undefined,
      {
        failOnNull: true,
      },
    );
    if (!current) this.notFound();
    await this.assertRelation({ ...current, ...input });
    return super.updateEntity(conditions, input, findOptions, returnEntity);
  }

  private async assertRelation(
    input: DeepPartial<OmniRelationEntity>,
  ): Promise<void> {
    const sourceRecordId = this.requiredIdentifier(
      input.sourceRecordId,
      'sourceRecordId',
    );
    const targetRecordId = this.requiredIdentifier(
      input.targetRecordId,
      'targetRecordId',
    );
    const kind = this.requiredIdentifier(input.kind, 'kind');
    try {
      this.kinds.assert(kind);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Omni relation kind is invalid.',
      );
    }

    const records = await this.recordRepository.find({
      where: [
        { scopeId: this.scopeId, guid: sourceRecordId, deletedAt: IsNull() },
        { scopeId: this.scopeId, guid: targetRecordId, deletedAt: IsNull() },
      ],
    });
    const source = records.find((record) => record.guid === sourceRecordId);
    const target = records.find((record) => record.guid === targetRecordId);
    if (!source || !target) this.notFound();

    const isCanonical = canonicalOmniRelationKinds.includes(
      kind as (typeof canonicalOmniRelationKinds)[number],
    );
    if (
      isCanonical &&
      !isAllowedOmniRelation({
        sourceKind: source.kind,
        targetKind: target.kind,
        relationKind: kind,
      })
    ) {
      throw new BadRequestException(
        'Omni relation kind is not valid for these endpoint kinds.',
      );
    }
  }

  private requiredIdentifier(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(
        `Omni relation ${field} must be a non-empty string.`,
      );
    }
    return value;
  }
}
