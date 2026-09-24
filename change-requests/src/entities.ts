import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ChangeRequestActor } from './types.js';

@Entity('change_requests')
export class ChangeRequestEntity {
  @PrimaryColumn('varchar') id!: string;
  @Column({ name: 'entity_type' }) entityType!: string;
  @Column() target!: string;
  @Column({ name: 'entity_id' }) entityId!: string;
  @Column({ type: 'varchar', nullable: true }) title!: string | null;
  @Column({ name: 'proposer_kind', type: 'varchar' })
  proposerKind!: ChangeRequestActor['kind'];
  @Column({ name: 'proposer_id', type: 'varchar', nullable: true })
  proposerId!: string | null;
  @Column({ name: 'proposer_label' }) proposerLabel!: string;
  @Column({ name: 'source_json', type: 'simple-json', nullable: true })
  source!: unknown | null;
  @Column({ type: 'varchar', nullable: true }) note!: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
  @OneToMany(() => ChangeRequestItemEntity, (item) => item.request)
  items!: ChangeRequestItemEntity[];
}

@Entity('change_request_items')
@Index(
  'uq_change_request_open_field',
  ['entityType', 'target', 'entityId', 'fieldKey', 'variant'],
  { unique: true },
)
export class ChangeRequestItemEntity {
  @PrimaryColumn('varchar') id!: string;
  @Column({ name: 'change_request_id' }) changeRequestId!: string;
  @ManyToOne(() => ChangeRequestEntity, (request) => request.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'change_request_id' })
  request!: ChangeRequestEntity;
  @Column({ name: 'entity_type' }) entityType!: string;
  @Column() target!: string;
  @Column({ name: 'entity_id' }) entityId!: string;
  @Column({ name: 'field_key' }) fieldKey!: string;
  @Column({ default: '' }) variant!: string;
  @Column({ type: 'varchar', default: 'proposed' }) state!:
    | 'proposed'
    | 'stale'
    | 'publish_failed';
  @Column({ name: 'base_hash' }) baseHash!: string;
  @Column({ name: 'base_value', type: 'simple-json', nullable: true })
  baseValue!: unknown | null;
  @Column({ name: 'proposed_value', type: 'simple-json', nullable: true })
  proposedValue!: unknown | null;
  @Column({ name: 'publish_error', type: 'varchar', nullable: true })
  publishError!: string | null;
}
