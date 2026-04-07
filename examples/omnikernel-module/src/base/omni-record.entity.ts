import { ObjectType } from '@nestjs/graphql';
import { Column, Entity, OneToMany } from 'typeorm';
import type { Relation } from 'typeorm';
import { OmniNamedEntity } from './omni-named.entity.js';
import { OmniRelationEntity } from './omni-relation.entity.js';

@Entity('omni-record')
@ObjectType({ isAbstract: true })
export class OmniRecordEntity extends OmniNamedEntity {
  @Column('varchar', { length: 64 })
  kind!: string;

  @Column('varchar', { default: 'draft', length: 32 })
  status!: string;

  @Column('simple-json', { nullable: true })
  payload?: Record<string, unknown> | null;

  @Column('simple-json', { nullable: true })
  aiContext?: Record<string, unknown> | null;

  @OneToMany(() => OmniRelationEntity, (relation) => relation.sourceRecord)
  outgoingRelations?: Relation<OmniRelationEntity[]>;

  @OneToMany(() => OmniRelationEntity, (relation) => relation.targetRecord)
  incomingRelations?: Relation<OmniRelationEntity[]>;
}
