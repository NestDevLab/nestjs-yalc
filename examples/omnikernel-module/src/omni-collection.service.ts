import type { CrudGenFindManyOptions } from '@nestjs-yalc/crud-gen/api-graphql/crud-gen-gql.interface';
import { GenericService } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import type { DeepPartial, FindOptionsWhere } from 'typeorm';
import { OmniCollectionKind } from './omni-collection-kind.enum';
import { OmniCollectionEntity } from './omni-collection.entity';

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
