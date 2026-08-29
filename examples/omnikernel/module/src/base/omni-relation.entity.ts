import { ObjectType } from '@nestjs/graphql';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { OmniBaseEntity } from './omni-base.entity.js';
import { OmniRecordEntity } from './omni-record.entity.js';
import { OmniRelationStatus } from '../omni-relation-status.enum.js';

@Entity('omni-relation')
@Index('omni_relation_scope_source_kind_status_created_guid_idx', [
  'scopeId',
  'sourceRecordId',
  'kind',
  'status',
  'createdAt',
  'guid',
])
@Index('omni_relation_scope_target_kind_status_created_guid_idx', [
  'scopeId',
  'targetRecordId',
  'kind',
  'status',
  'createdAt',
  'guid',
])
@Index(
  'omni_relation_scope_edge_kind_status_unique',
  ['scopeId', 'sourceRecordId', 'targetRecordId', 'kind', 'status'],
  { unique: true },
)
@ObjectType({ isAbstract: true })
export class OmniRelationEntity extends OmniBaseEntity {
  @Column({ type: 'varchar', length: 36 })
  sourceRecordId!: string;

  @ManyToOne(() => OmniRecordEntity, (record) => record.outgoingRelations)
  @JoinColumn([
    { name: 'scopeId', referencedColumnName: 'scopeId' },
    { name: 'sourceRecordId', referencedColumnName: 'guid' },
  ])
  sourceRecord!: Relation<OmniRecordEntity>;

  @Column({ type: 'varchar', length: 36 })
  targetRecordId!: string;

  @ManyToOne(() => OmniRecordEntity, (record) => record.incomingRelations)
  @JoinColumn([
    { name: 'scopeId', referencedColumnName: 'scopeId' },
    { name: 'targetRecordId', referencedColumnName: 'guid' },
  ])
  targetRecord!: Relation<OmniRecordEntity>;

  /** Validated by the registered relation-kind contract, not a closed enum. */
  @Column({ type: 'varchar', length: 64 })
  kind!: string;

  @Column({
    type: 'varchar',
    default: OmniRelationStatus.Active,
    enum: Object.values(OmniRelationStatus),
    length: 32,
  })
  status!: OmniRelationStatus;

  @Column({ type: 'simple-json', nullable: true })
  payload?: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true, length: 128 })
  payloadSchemaId?: string | null;

  @Column({ type: 'integer', nullable: true })
  payloadSchemaVersion?: number | null;
}
