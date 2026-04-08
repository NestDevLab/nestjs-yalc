import type { CrudGenFindManyOptions } from '../../../crud-gen/src/api-graphql/crud-gen-gql.interface.js';
import { GenericService } from '../../../crud-gen/src/typeorm/generic.service.js';
import type { DeepPartial, FindOptionsWhere } from 'typeorm';
import { OmniCollectionKind } from './omni-collection-kind.enum.js';
import { OmniCollectionEntity } from './omni-collection.entity.js';

export class OmniCollectionService extends GenericService<OmniCollectionEntity> {
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
