import { ObjectType } from '@nestjs/graphql';
import { ChildEntity, Column } from 'typeorm';
import { OmniRecordEntity } from './base/omni-record.entity';
import { OmniCollectionKind } from './omni-collection-kind.enum';

@ChildEntity(OmniCollectionKind.Collection)
@ObjectType({ isAbstract: true })
export class OmniCollectionEntity extends OmniRecordEntity {
  kind: OmniCollectionKind = OmniCollectionKind.Collection;

  @Column({
    type: 'varchar',
    default: OmniCollectionKind.Collection,
    enum: Object.values(OmniCollectionKind),
    length: 32,
  })
  collectionKind!: OmniCollectionKind;

  @Column({ type: 'text', nullable: true })
  summary?: string | null;
}
