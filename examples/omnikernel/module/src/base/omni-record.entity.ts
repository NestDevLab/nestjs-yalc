import { ObjectType } from '@nestjs/graphql';
import { Column, Entity, OneToMany, TableInheritance } from 'typeorm';
import type { Relation } from 'typeorm';
import { OmniNamedEntity } from './omni-named.entity';
import { OmniRelationEntity } from './omni-relation.entity';
import { OmniRecordStatus } from '../omni-record-status.enum';

@Entity('omni-record')
@TableInheritance({
  column: {
    name: 'recordType',
    type: 'varchar',
    length: 32,
  },
})
@ObjectType({ isAbstract: true })
export class OmniRecordEntity extends OmniNamedEntity {
  @Column({ type: 'varchar', length: 64 })
  kind!: string;

  @Column({
    type: 'varchar',
    default: OmniRecordStatus.Draft,
    enum: Object.values(OmniRecordStatus),
    length: 32,
  })
  status!: OmniRecordStatus;

  @Column({ type: 'simple-json', nullable: true })
  payload?: Record<string, unknown> | null;

  @OneToMany(() => OmniRelationEntity, (relation) => relation.sourceRecord)
  outgoingRelations?: Relation<OmniRelationEntity[]>;

  @OneToMany(() => OmniRelationEntity, (relation) => relation.targetRecord)
  incomingRelations?: Relation<OmniRelationEntity[]>;
}
