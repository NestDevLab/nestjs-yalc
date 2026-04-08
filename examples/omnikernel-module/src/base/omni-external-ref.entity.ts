import { ObjectType } from '@nestjs/graphql';
import { Column, Entity } from 'typeorm';
import { OmniBaseEntity } from './omni-base.entity.js';
import { OmniExternalRefInternalType } from '../omni-external-ref-internal-type.enum.js';

@Entity('omni-external-ref')
@ObjectType({ isAbstract: true })
export class OmniExternalRefEntity extends OmniBaseEntity {
  @Column('varchar', {
    enum: Object.values(OmniExternalRefInternalType),
    length: 64,
  })
  internalType!: OmniExternalRefInternalType;

  @Column('varchar', { length: 36 })
  internalId!: string;

  @Column('varchar', { length: 128 })
  provider!: string;

  @Column('varchar', { nullable: true, length: 128 })
  account?: string | null;

  @Column('varchar', { nullable: true, length: 128 })
  container?: string | null;

  @Column('varchar', { length: 255 })
  externalId!: string;

  @Column('simple-json', { nullable: true })
  payload?: Record<string, unknown> | null;
}
