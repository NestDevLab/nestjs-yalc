import { ObjectType } from '@nestjs/graphql';
import { Column, Entity } from 'typeorm';
import { OmniBaseEntity } from './omni-base.entity';
import { OmniExternalRefInternalType } from '../omni-external-ref-internal-type.enum';

@Entity('omni-external-ref')
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

  @Column({ type: 'varchar', nullable: true, length: 128 })
  account?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 128 })
  container?: string | null;

  @Column({ type: 'varchar', length: 255 })
  externalId!: string;

  @Column({ type: 'simple-json', nullable: true })
  payload?: Record<string, unknown> | null;
}
