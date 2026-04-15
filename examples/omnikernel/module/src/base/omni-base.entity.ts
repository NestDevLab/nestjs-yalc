import { EntityWithTimestamps } from '@nestjs-yalc/database/timestamp.entity';
import { ObjectType } from '@nestjs/graphql';
import { BaseEntity, PrimaryColumn } from 'typeorm';

@ObjectType({ isAbstract: true })
export abstract class OmniBaseEntity extends EntityWithTimestamps(BaseEntity) {
  @PrimaryColumn('varchar', { name: 'guid', length: 36 })
  guid!: string;

  declare createdAt: Date;

  declare updatedAt: Date;
}
