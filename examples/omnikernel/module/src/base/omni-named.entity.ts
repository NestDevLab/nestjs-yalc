import { ObjectType } from '@nestjs/graphql';
import { Column, Entity } from 'typeorm';
import { OmniBaseEntity } from './omni-base.entity';

@Entity('omni-named')
@ObjectType({ isAbstract: true })
export class OmniNamedEntity extends OmniBaseEntity {
  @Column({ type: 'varchar', nullable: true, length: 128 })
  externalId?: string | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', nullable: true, length: 255 })
  slug?: string | null;
}
