import { EntityWithTimestamps } from '@nestjs-yalc/database/timestamp.entity.js';
import { ObjectType } from '@nestjs/graphql';
import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('task-sync-state')
@ObjectType({ isAbstract: true })
export class TaskSyncState extends EntityWithTimestamps(BaseEntity) {
  @PrimaryColumn('varchar', { name: 'guid', length: 36 })
  guid: string;

  @Column('varchar', { length: 36 })
  externalRefId: string;

  @Column('varchar', { default: 'active' })
  status: string;

  @Column('datetime', { nullable: true })
  lastSyncedAt?: Date | null;

  @Column('varchar', { nullable: true })
  lastDirection?: string | null;

  @Column('varchar', { nullable: true })
  remoteVersion?: string | null;

  @Column('varchar', { nullable: true })
  localVersionHash?: string | null;

  @Column('text', { nullable: true })
  lastError?: string | null;
}
