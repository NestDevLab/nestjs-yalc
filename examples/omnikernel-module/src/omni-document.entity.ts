import { ObjectType } from '@nestjs/graphql';
import { ChildEntity, Column } from 'typeorm';
import { OmniRecordEntity } from './base/omni-record.entity';
import { OmniDocumentKind } from './omni-document-kind.enum';

@ChildEntity(OmniDocumentKind.Document)
@ObjectType({ isAbstract: true })
export class OmniDocumentEntity extends OmniRecordEntity {
  kind: OmniDocumentKind = OmniDocumentKind.Document;

  @Column({
    type: 'varchar',
    default: OmniDocumentKind.Document,
    enum: Object.values(OmniDocumentKind),
    length: 32,
  })
  documentKind!: OmniDocumentKind;

  @Column({ type: 'text', nullable: true })
  content?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 128 })
  contentMimeType?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 2048 })
  sourceUrl?: string | null;

  @Column({ type: 'datetime', nullable: true })
  publishedAt?: Date | null;
}
