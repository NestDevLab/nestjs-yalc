import { ObjectType } from '@nestjs/graphql';
import {
  BaseEntity,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

@ObjectType({ isAbstract: true })
export abstract class OmniBaseEntity extends BaseEntity {
  /**
   * The server-owned partition key. It is never represented by the public
   * CRUD DTOs. Together with guid it is the composite primary identity, which
   * lets the same logical GUID exist in independent server-owned partitions.
   */
  @PrimaryColumn('varchar', {
    name: 'scopeId',
    length: 64,
    default: 'default',
  })
  scopeId: string = 'default';

  @PrimaryColumn('varchar', { name: 'guid', length: 36 })
  guid!: string;

  /** Server-managed optimistic version for ordinary Omni updates. */
  @VersionColumn({ type: 'integer', default: 1 })
  revision!: number;

  /** Present only for resources configured with the tombstone lifecycle. */
  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
