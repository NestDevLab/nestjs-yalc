import { InputType, ObjectType, OmitType, PartialType } from '@nestjs/graphql';
import {
  ModelField,
  ModelObject,
} from '@nestjs-yalc/crud-gen/object.decorator.js';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar.js';
import returnValue from '@nestjs-yalc/utils/returnValue.js';
import {
  IsDate,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { GraphQLJSONObject } from 'graphql-type-json';
import type { Relation } from 'typeorm';
import { OmniDocumentEntity } from './omni-document.entity.js';
import { OmniDocumentKind } from './omni-document-kind.enum.js';
import { OmniRecordStatus } from './omni-record-status.enum.js';
import { OmniRelationEntity } from './base/omni-relation.entity.js';
import { OmniRelationType } from './omni-relation.dto.js';

@ObjectType()
@ModelObject()
export class OmniDocumentType extends OmniDocumentEntity {
  constructor(data?: Partial<OmniDocumentType>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  @IsUUID()
  guid!: string;

  @ModelField({
    gqlType: returnValue(String),
    gqlOptions: { nullable: true },
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  externalId?: string | null;

  @ModelField({ gqlType: returnValue(String) })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ModelField({
    gqlType: returnValue(String),
    gqlOptions: { nullable: true },
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string | null;

  @ModelField({ gqlType: returnValue(String) })
  @IsString()
  @IsIn([OmniDocumentKind.Document])
  kind!: string;

  @ModelField({ gqlType: returnValue(OmniRecordStatus) })
  @IsEnum(OmniRecordStatus)
  status!: OmniRecordStatus;

  @ModelField({
    gqlType: returnValue(GraphQLJSONObject),
    gqlOptions: { nullable: true },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown> | null;

  @ModelField({
    gqlType: () => [OmniRelationType],
    gqlOptions: { nullable: true },
    relation: {
      relationType: 'one-to-many',
      sourceKey: { dst: 'guid', alias: 'guid' },
      targetKey: { dst: 'sourceRecordId', alias: 'sourceRecordId' },
      type: () => OmniRelationEntity,
    },
  })
  outgoingRelations?: Relation<OmniRelationType[]>;

  @ModelField({
    gqlType: () => [OmniRelationType],
    gqlOptions: { nullable: true },
    relation: {
      relationType: 'one-to-many',
      sourceKey: { dst: 'guid', alias: 'guid' },
      targetKey: { dst: 'targetRecordId', alias: 'targetRecordId' },
      type: () => OmniRelationEntity,
    },
  })
  incomingRelations?: Relation<OmniRelationType[]>;

  @ModelField({ gqlType: returnValue(OmniDocumentKind) })
  @IsEnum(OmniDocumentKind)
  documentKind!: OmniDocumentKind;

  @ModelField({
    gqlType: returnValue(String),
    gqlOptions: { nullable: true },
  })
  @IsOptional()
  @IsString()
  content?: string | null;

  @ModelField({
    gqlType: returnValue(String),
    gqlOptions: { nullable: true },
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  contentMimeType?: string | null;

  @ModelField({
    gqlType: returnValue(String),
    gqlOptions: { nullable: true },
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  sourceUrl?: string | null;

  @ModelField({
    gqlType: returnValue(Date),
    gqlOptions: { nullable: true },
  })
  @IsOptional()
  @IsDate()
  publishedAt?: Date | null;
}

@InputType()
@ModelObject()
export class OmniDocumentCreateInput extends OmitType(
  OmniDocumentType,
  [
    'createdAt',
    'updatedAt',
    'kind',
    'outgoingRelations',
    'incomingRelations',
  ] as const,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: OmniDocumentType })
export class OmniDocumentCondition extends PartialType(
  OmniDocumentCreateInput,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: OmniDocumentType })
export class OmniDocumentUpdateInput extends PartialType(
  OmniDocumentCreateInput,
  InputType,
) {}
