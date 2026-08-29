import { ObjectType } from '@nestjs/graphql';
import { Column, Entity, Index } from 'typeorm';
import { OmniBaseEntity } from './omni-base.entity.js';
import { OmniExternalRefInternalType } from '../omni-external-ref-internal-type.enum.js';

@Entity('omni-external-ref')
@Index(
  'omni_external_ref_scope_external_identity_unique',
  ['scopeId', 'provider', 'account', 'container', 'externalId'],
  { unique: true },
)
@Index('omni_external_ref_scope_internal_lookup_idx', [
  'scopeId',
  'internalType',
  'internalId',
  'provider',
  'guid',
])
@ObjectType({ isAbstract: true })
export class OmniExternalRefEntity extends OmniBaseEntity {
  @Column({
    type: 'varchar',
    enum: Object.values(OmniExternalRefInternalType),
    length: 64,
  })
  internalType!: OmniExternalRefInternalType;

  @Column({ type: 'varchar', length: 36 })
  internalId!: string;

  @Column({ type: 'varchar', length: 128 })
  provider!: string;

  /** Empty string is the canonical storage representation of no account. */
  @Column({ type: 'varchar', default: '', length: 128 })
  account?: string | null;

  /** Empty string is the canonical storage representation of no container. */
  @Column({ type: 'varchar', default: '', length: 128 })
  container?: string | null;

  @Column({ type: 'varchar', length: 255 })
  externalId!: string;

  @Column({ type: 'simple-json', nullable: true })
  payload?: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true, length: 128 })
  payloadSchemaId?: string | null;

  @Column({ type: 'integer', nullable: true })
  payloadSchemaVersion?: number | null;
}
