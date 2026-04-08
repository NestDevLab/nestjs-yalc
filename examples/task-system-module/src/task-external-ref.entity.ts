import { EntityWithTimestamps } from '@nestjs-yalc/database/timestamp.entity.js';
import { ObjectType } from '@nestjs/graphql';
import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('task-external-ref')
@ObjectType({ isAbstract: true })
export class TaskExternalRef extends EntityWithTimestamps(BaseEntity) {
  @PrimaryColumn('varchar', { name: 'guid', length: 36 })
  guid: string;

  @Column('varchar')
  internalType: string;

  @Column('varchar', { length: 36 })
  internalId: string;

  @Column('varchar')
  provider: string;

  @Column('varchar', { nullable: true })
  account?: string | null;

  @Column('varchar', { nullable: true })
  container?: string | null;

  @Column('varchar')
  externalId: string;
}
