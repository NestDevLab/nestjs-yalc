import { ObjectType } from '@nestjs/graphql';
import { Column, Entity, Index, OneToMany, TableInheritance } from 'typeorm';
import type { Relation } from 'typeorm';
import { OmniNamedEntity } from './omni-named.entity.js';
import { OmniRelationEntity } from './omni-relation.entity.js';
import { OmniRecordStatus } from '../omni-record-status.enum.js';

@Entity('omni-record')
@Index('omni_record_scope_kind_status_guid_idx', [
  'scopeId',
  'kind',
  'status',
  'guid',
])
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

  /** Logical schema identity for JSON payload compatibility and migration. */
  @Column({ type: 'varchar', nullable: true, length: 128 })
  payloadSchemaId?: string | null;

  /** Revision of payloadSchemaId; a schema change is explicit metadata. */
  @Column({ type: 'integer', nullable: true })
  payloadSchemaVersion?: number | null;

  @OneToMany(() => OmniRelationEntity, (relation) => relation.sourceRecord)
  outgoingRelations?: Relation<OmniRelationEntity[]>;

  @OneToMany(() => OmniRelationEntity, (relation) => relation.targetRecord)
  incomingRelations?: Relation<OmniRelationEntity[]>;
}
