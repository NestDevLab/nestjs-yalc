import { EntityWithTimestamps } from '@nestjs-yalc/database/timestamp.entity.js';
import { ObjectType } from '@nestjs/graphql';
import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('task-event')
@ObjectType({ isAbstract: true })
export class TaskEvent extends EntityWithTimestamps(BaseEntity) {
  @PrimaryColumn('varchar', { name: 'guid', length: 36 })
  guid: string;

  @Column('varchar')
  title: string;

  @Column('text', { nullable: true })
  description?: string | null;

  @Column('varchar', { default: 'scheduled' })
  status: string;

  @Column('datetime')
  startAt: Date;

  @Column('datetime', { nullable: true })
  endAt?: Date | null;

  @Column('boolean', { default: false })
  allDay: boolean;

  @Column('varchar', { nullable: true, length: 36 })
  projectId?: string | null;

  @Column('varchar', { nullable: true })
  location?: string | null;
}
