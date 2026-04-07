import { ObjectType } from '@nestjs/graphql';
import { BeforeInsert, BeforeUpdate, Column, Entity } from 'typeorm';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import { OmniDocumentKind } from './omni-document-kind.enum.js';

@Entity('omni-document')
@ObjectType({ isAbstract: true })
export class OmniDocumentEntity extends OmniRecordEntity {
  @Column('varchar', {
    default: OmniDocumentKind.Document,
    enum: Object.values(OmniDocumentKind),
    length: 32,
  })
  documentKind!: OmniDocumentKind;

  @Column('text', { nullable: true })
  content?: string | null;

  @Column('varchar', { nullable: true, length: 128 })
  contentMimeType?: string | null;

  @Column('varchar', { nullable: true, length: 2048 })
  sourceUrl?: string | null;

  @Column('datetime', { nullable: true })
  publishedAt?: Date | null;

  @BeforeInsert()
  @BeforeUpdate()
  ensureDocumentRecordKind() {
    if (!this.kind) {
      this.kind = OmniDocumentKind.Document;
    }
  }
}
