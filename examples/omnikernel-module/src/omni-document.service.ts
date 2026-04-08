import type { CrudGenFindManyOptions } from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interface.js';
import { GenericService } from '@nestjs-yalc/crud-gen/typeorm/generic.service.js';
import type { DeepPartial, FindOptionsWhere } from 'typeorm';
import { OmniDocumentKind } from './omni-document-kind.enum.js';
import { OmniDocumentEntity } from './omni-document.entity.js';

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
