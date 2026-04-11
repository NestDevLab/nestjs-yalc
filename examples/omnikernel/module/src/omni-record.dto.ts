import { InputType, ObjectType, OmitType, PartialType } from '@nestjs/graphql';
import {
  ModelField,
  ModelObject,
} from '@nestjs-yalc/crud-gen/object.decorator';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar';
import returnValue from '@nestjs-yalc/utils/returnValue';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { GraphQLJSONObject } from 'graphql-type-json';
import type { Relation } from 'typeorm';
import { OmniRecordEntity } from './base/omni-record.entity';
import { OmniRelationEntity } from './base/omni-relation.entity';
import { OmniRelationType } from './omni-relation.dto';
import { OmniRecordStatus } from './omni-record-status.enum';

@ObjectType()
@ModelObject()
export class OmniRecordType extends OmniRecordEntity {
  constructor(data?: Partial<OmniRecordType>) {
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
  @MaxLength(64)
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
}

@InputType()
@ModelObject()
export class OmniRecordCreateInput extends OmitType(
  OmniRecordType,
  ['createdAt', 'updatedAt', 'outgoingRelations', 'incomingRelations'] as const,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: OmniRecordType })
export class OmniRecordCondition extends PartialType(
  OmniRecordCreateInput,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: OmniRecordType })
export class OmniRecordUpdateInput extends PartialType(
  OmniRecordCreateInput,
  InputType,
) {}
