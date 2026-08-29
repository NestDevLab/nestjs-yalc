import type { CrudGenFindManyOptions } from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interface.js';
import type { GenericTypeORMRepository } from '@nestjs-yalc/crud-gen/typeorm/generic.repository.js';
import type { DeepPartial, FindOptionsWhere } from 'typeorm';
import { OmniCollectionKind } from './omni-collection-kind.enum.js';
import { OmniCollectionEntity } from './omni-collection.entity.js';
import type { OmniDeletePolicy, OmniScope } from './omni-scope.js';
import { OmniScopedService } from './omni-scoped.service.js';

export class OmniCollectionService extends OmniScopedService<OmniCollectionEntity> {
  constructor(
    repository: GenericTypeORMRepository<OmniCollectionEntity>,
    scopeOrRepositoryWrite?:
      | OmniScope
      | GenericTypeORMRepository<OmniCollectionEntity>,
    deletion: OmniDeletePolicy = 'tombstone',
  ) {
    super(repository, scopeOrRepositoryWrite, deletion);
  }

  protected normalizeCollectionInput(
    input: DeepPartial<OmniCollectionEntity>,
  ): DeepPartial<OmniCollectionEntity> {
    return {
      ...input,
      kind: OmniCollectionKind.Collection,
    };
  }

  override async createEntity(
    input: DeepPartial<OmniCollectionEntity>,
    findOptions?: CrudGenFindManyOptions<OmniCollectionEntity>,
    returnEntity?: true,
  ): Promise<OmniCollectionEntity>;
  override async createEntity(
    input: DeepPartial<OmniCollectionEntity>,
    findOptions?: CrudGenFindManyOptions<OmniCollectionEntity>,
    returnEntity?: boolean,
  ): Promise<OmniCollectionEntity | boolean>;
  override async createEntity(
    input: DeepPartial<OmniCollectionEntity>,
    findOptions?: CrudGenFindManyOptions<OmniCollectionEntity>,
    returnEntity = true,
  ): Promise<OmniCollectionEntity | boolean> {
    return super.createEntity(
      this.normalizeCollectionInput(input),
      findOptions,
      returnEntity,
    );
  }

  override async updateEntity(
    conditions: FindOptionsWhere<OmniCollectionEntity>,
    input: DeepPartial<OmniCollectionEntity>,
    findOptions?: CrudGenFindManyOptions<OmniCollectionEntity>,
    returnEntity?: true,
  ): Promise<OmniCollectionEntity>;
  override async updateEntity(
    conditions: FindOptionsWhere<OmniCollectionEntity>,
    input: DeepPartial<OmniCollectionEntity>,
    findOptions?: CrudGenFindManyOptions<OmniCollectionEntity>,
    returnEntity?: boolean,
  ): Promise<OmniCollectionEntity | boolean>;
  override async updateEntity(
    conditions: FindOptionsWhere<OmniCollectionEntity>,
    input: DeepPartial<OmniCollectionEntity>,
    findOptions?: CrudGenFindManyOptions<OmniCollectionEntity>,
    returnEntity = true,
  ): Promise<OmniCollectionEntity | boolean> {
    return super.updateEntity(
      conditions,
      this.normalizeCollectionInput(input),
      findOptions,
      returnEntity,
    );
  }
}
