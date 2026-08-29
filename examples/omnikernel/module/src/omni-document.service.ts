import type { CrudGenFindManyOptions } from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interface.js';
import type { GenericTypeORMRepository } from '@nestjs-yalc/crud-gen/typeorm/generic.repository.js';
import type { DeepPartial, FindOptionsWhere } from 'typeorm';
import { OmniDocumentKind } from './omni-document-kind.enum.js';
import { OmniDocumentEntity } from './omni-document.entity.js';
import type { OmniDeletePolicy, OmniScope } from './omni-scope.js';
import { OmniScopedService } from './omni-scoped.service.js';

export class OmniDocumentService extends OmniScopedService<OmniDocumentEntity> {
  constructor(
    repository: GenericTypeORMRepository<OmniDocumentEntity>,
    scopeOrRepositoryWrite?:
      | OmniScope
      | GenericTypeORMRepository<OmniDocumentEntity>,
    deletion: OmniDeletePolicy = 'tombstone',
  ) {
    super(repository, scopeOrRepositoryWrite, deletion);
  }

  protected normalizeDocumentInput(
    input: DeepPartial<OmniDocumentEntity>,
  ): DeepPartial<OmniDocumentEntity> {
    return {
      ...input,
      kind: OmniDocumentKind.Document,
    };
  }

  override async createEntity(
    input: DeepPartial<OmniDocumentEntity>,
    findOptions?: CrudGenFindManyOptions<OmniDocumentEntity>,
    returnEntity?: true,
  ): Promise<OmniDocumentEntity>;
  override async createEntity(
    input: DeepPartial<OmniDocumentEntity>,
    findOptions?: CrudGenFindManyOptions<OmniDocumentEntity>,
    returnEntity?: boolean,
  ): Promise<OmniDocumentEntity | boolean>;
  override async createEntity(
    input: DeepPartial<OmniDocumentEntity>,
    findOptions?: CrudGenFindManyOptions<OmniDocumentEntity>,
    returnEntity = true,
  ): Promise<OmniDocumentEntity | boolean> {
    return super.createEntity(
      this.normalizeDocumentInput(input),
      findOptions,
      returnEntity,
    );
  }

  override async updateEntity(
    conditions: FindOptionsWhere<OmniDocumentEntity>,
    input: DeepPartial<OmniDocumentEntity>,
    findOptions?: CrudGenFindManyOptions<OmniDocumentEntity>,
    returnEntity?: true,
  ): Promise<OmniDocumentEntity>;
  override async updateEntity(
    conditions: FindOptionsWhere<OmniDocumentEntity>,
    input: DeepPartial<OmniDocumentEntity>,
    findOptions?: CrudGenFindManyOptions<OmniDocumentEntity>,
    returnEntity?: boolean,
  ): Promise<OmniDocumentEntity | boolean>;
  override async updateEntity(
    conditions: FindOptionsWhere<OmniDocumentEntity>,
    input: DeepPartial<OmniDocumentEntity>,
    findOptions?: CrudGenFindManyOptions<OmniDocumentEntity>,
    returnEntity = true,
  ): Promise<OmniDocumentEntity | boolean> {
    return super.updateEntity(
      conditions,
      this.normalizeDocumentInput(input),
      findOptions,
      returnEntity,
    );
  }
}
