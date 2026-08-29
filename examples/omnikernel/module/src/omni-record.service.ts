import { BadRequestException } from '@nestjs/common';
import type { CrudGenFindManyOptions } from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interface.js';
import type { GenericTypeORMRepository } from '@nestjs-yalc/crud-gen/typeorm/generic.repository.js';
import { In, Not, type DeepPartial, type FindOptionsWhere } from 'typeorm';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import type { OmniDeletePolicy, OmniScope } from './omni-scope.js';
import { OmniScopedService } from './omni-scoped.service.js';

/**
 * Raw Omni record CRUD with a mechanical boundary around extension-owned
 * kinds. A registered extension is the only writer for its owner lifecycle;
 * mounting a generic record transport cannot turn another record into that
 * kind or mutate/delete an existing owner.
 */
export class OmniRecordService extends OmniScopedService<OmniRecordEntity> {
  private readonly reservedKinds: ReadonlySet<string>;

  constructor(
    repository: GenericTypeORMRepository<OmniRecordEntity>,
    scopeOrRepositoryWrite?:
      | OmniScope
      | GenericTypeORMRepository<OmniRecordEntity>,
    deletion: OmniDeletePolicy = 'tombstone',
    reservedRecordKinds: readonly string[] = [],
  ) {
    super(repository, scopeOrRepositoryWrite, deletion);
    this.reservedKinds = new Set(reservedRecordKinds);
  }

  override async createEntity(
    input: DeepPartial<OmniRecordEntity>,
    findOptions?: CrudGenFindManyOptions<OmniRecordEntity>,
    returnEntity?: true,
  ): Promise<OmniRecordEntity>;
  override async createEntity(
    input: DeepPartial<OmniRecordEntity>,
    findOptions?: CrudGenFindManyOptions<OmniRecordEntity>,
    returnEntity?: boolean,
  ): Promise<OmniRecordEntity | boolean>;
  override async createEntity(
    input: DeepPartial<OmniRecordEntity>,
    findOptions?: CrudGenFindManyOptions<OmniRecordEntity>,
    returnEntity = true,
  ): Promise<OmniRecordEntity | boolean> {
    this.rejectReservedKind(input.kind);
    return super.createEntity(input, findOptions, returnEntity);
  }

  override async updateEntity(
    conditions: FindOptionsWhere<OmniRecordEntity>,
    input: DeepPartial<OmniRecordEntity>,
    findOptions?: CrudGenFindManyOptions<OmniRecordEntity>,
    returnEntity?: true,
  ): Promise<OmniRecordEntity>;
  override async updateEntity(
    conditions: FindOptionsWhere<OmniRecordEntity>,
    input: DeepPartial<OmniRecordEntity>,
    findOptions?: CrudGenFindManyOptions<OmniRecordEntity>,
    returnEntity?: boolean,
  ): Promise<OmniRecordEntity | boolean>;
  override async updateEntity(
    conditions: FindOptionsWhere<OmniRecordEntity>,
    input: DeepPartial<OmniRecordEntity>,
    findOptions?: CrudGenFindManyOptions<OmniRecordEntity>,
    returnEntity = true,
  ): Promise<OmniRecordEntity | boolean> {
    this.rejectReservedKind(input.kind);
    await this.assertExistingRecordIsNotReserved(conditions);
    return super.updateEntity(
      this.nonReservedConditions(conditions),
      input,
      findOptions,
      returnEntity,
    );
  }

  override async deleteEntity(
    conditions: FindOptionsWhere<OmniRecordEntity>,
  ): Promise<boolean> {
    await this.assertExistingRecordIsNotReserved(conditions);
    return super.deleteEntity(this.nonReservedConditions(conditions));
  }

  private async assertExistingRecordIsNotReserved(
    conditions: FindOptionsWhere<OmniRecordEntity>,
  ): Promise<void> {
    const record = await super.getEntity(
      conditions,
      undefined,
      undefined,
      undefined,
      { failOnNull: false },
    );
    if (record) this.rejectReservedKind(record.kind);
  }

  private nonReservedConditions(
    conditions: FindOptionsWhere<OmniRecordEntity>,
  ): FindOptionsWhere<OmniRecordEntity> {
    if (this.reservedKinds.size === 0) return conditions;
    return {
      ...conditions,
      kind: Not(In([...this.reservedKinds])),
    };
  }

  private rejectReservedKind(kind: unknown): void {
    if (typeof kind === 'string' && this.reservedKinds.has(kind)) {
      throw new BadRequestException(
        'This record kind is owned by a registered extension projection.',
      );
    }
  }
}
