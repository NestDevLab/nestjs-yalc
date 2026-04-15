import { EntityWithTimestamps } from '@nestjs-yalc/database/timestamp.entity.js';
import { ObjectType } from '@nestjs/graphql';
import { BaseEntity, Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { TaskEvent } from './task-event.entity.js';
import { TaskItem } from './task-item.entity.js';

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

  @OneToMany(() => TaskItem, (task) => task.project)
  tasks?: Relation<TaskItem[]>;

  @OneToMany(() => TaskEvent, (event) => event.project)
  events?: Relation<TaskEvent[]>;
}
