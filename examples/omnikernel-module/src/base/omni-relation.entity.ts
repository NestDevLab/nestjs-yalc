import { ObjectType } from '@nestjs/graphql';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { OmniBaseEntity } from './omni-base.entity';
import { OmniRecordEntity } from './omni-record.entity';
import { OmniRelationKind } from '../omni-relation-kind.enum';
import { OmniRelationStatus } from '../omni-relation-status.enum';

@Entity('omni-relation')
@ObjectType({ isAbstract: true })
export class OmniRelationEntity extends OmniBaseEntity {
  @Column({ type: 'varchar', length: 36 })
  sourceRecordId!: string;

  @ManyToOne(() => OmniRecordEntity, (record) => record.outgoingRelations)
  @JoinColumn({ name: 'sourceRecordId', referencedColumnName: 'guid' })
  sourceRecord!: Relation<OmniRecordEntity>;

  @Column({ type: 'varchar', length: 36 })
  targetRecordId!: string;

  @ManyToOne(() => OmniRecordEntity, (record) => record.incomingRelations)
  @JoinColumn({ name: 'targetRecordId', referencedColumnName: 'guid' })
  targetRecord!: Relation<OmniRecordEntity>;

  @Column({
    type: 'varchar',
    enum: Object.values(OmniRelationKind),
    length: 64,
  })
  kind!: OmniRelationKind;

  @Column({
    type: 'varchar',
    default: OmniRelationStatus.Active,
    enum: Object.values(OmniRelationStatus),
    length: 32,
  })
  status!: OmniRelationStatus;

  @Column({ type: 'simple-json', nullable: true })
  payload?: Record<string, unknown> | null;
}
