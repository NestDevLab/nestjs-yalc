import type { CrudGenFindManyOptions } from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interface';
import { GenericService } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import type { DeepPartial, FindOptionsWhere } from 'typeorm';
import { OmniDocumentKind } from './omni-document-kind.enum';
import { OmniDocumentEntity } from './omni-document.entity';

export class OmniDocumentService extends GenericService<OmniDocumentEntity> {
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
