import { EntityWithTimestamps } from '@nestjs-yalc/database/timestamp.entity.js';
import { ObjectType } from '@nestjs/graphql';
import { BaseEntity, PrimaryColumn } from 'typeorm';

@ObjectType({ isAbstract: true })
export abstract class OmniBaseEntity extends EntityWithTimestamps(BaseEntity) {
  @PrimaryColumn('varchar', { name: 'guid', length: 36 })
  guid!: string;
}
