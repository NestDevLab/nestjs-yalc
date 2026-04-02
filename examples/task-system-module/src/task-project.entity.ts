import { EntityWithTimestamps } from '@nestjs-yalc/database/timestamp.entity.js';
import { ObjectType } from '@nestjs/graphql';
import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('task-project')
@ObjectType({ isAbstract: true })
export class TaskProject extends EntityWithTimestamps(BaseEntity) {
  @PrimaryColumn('varchar', { name: 'guid', length: 36 })
  guid: string;

  @Column('varchar')
  name: string;

  @Column('text', { nullable: true })
  description?: string | null;

  @Column('varchar', { default: 'active' })
  status: string;
}
