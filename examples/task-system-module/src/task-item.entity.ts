import { EntityWithTimestamps } from '@nestjs-yalc/database/timestamp.entity.js';
import { ObjectType } from '@nestjs/graphql';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { TaskProject } from './task-project.entity.js';

@Entity('task-item')
@ObjectType({ isAbstract: true })
export class TaskItem extends EntityWithTimestamps(BaseEntity) {
  @PrimaryColumn('varchar', { name: 'guid', length: 36 })
  guid: string;

  @Column('varchar')
  title: string;

  @Column('text', { nullable: true })
  description?: string | null;

  @Column('varchar', { default: 'todo' })
  status: string;

  @Column('varchar', { nullable: true, length: 36 })
  projectId?: string | null;

  @ManyToOne(() => TaskProject, (project) => project.tasks, { nullable: true })
  @JoinColumn({ name: 'projectId', referencedColumnName: 'guid' })
  project?: TaskProject | null;

  @Column('datetime', { nullable: true })
  dueAt?: Date | null;
}
