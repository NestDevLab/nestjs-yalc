import {
  Field,
  InputType,
  ObjectType,
  OmitType,
  PartialType,
} from '@nestjs/graphql';
import {
  ModelField,
  ModelObject,
} from '@nestjs-yalc/crud-gen/object.decorator.js';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar.js';
import returnValue from '@nestjs-yalc/utils/returnValue.js';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { GraphQLJSONObject } from 'graphql-type-json';
import type { Relation } from 'typeorm';
import { OmniRecordEntity } from './base/omni-record.entity.js';
import { OmniRelationEntity } from './base/omni-relation.entity.js';
import { OmniRecordType } from './omni-record.dto.js';

@ObjectType()
@ModelObject()
export class OmniRelationType extends OmniRelationEntity {
  constructor(data?: Partial<OmniRelationType>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  @Field(() => UUIDScalar)
  @IsUUID()
  guid!: string;

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  @Field(() => UUIDScalar)
  @IsUUID()
  sourceRecordId!: string;

  @ModelField({
    gqlType: returnValue(OmniRecordType),
    gqlOptions: { nullable: false },
    relation: {
      relationType: 'many-to-one',
      sourceKey: { dst: 'sourceRecordId', alias: 'sourceRecordId' },
      targetKey: { dst: 'guid', alias: 'guid' },
      type: () => OmniRecordEntity,
    },
  })
  @Field(() => OmniRecordType)
  sourceRecord!: Relation<OmniRecordType>;

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  @Field(() => UUIDScalar)
  @IsUUID()
  targetRecordId!: string;

  @ModelField({
    gqlType: returnValue(OmniRecordType),
    gqlOptions: { nullable: false },
    relation: {
      relationType: 'many-to-one',
      sourceKey: { dst: 'targetRecordId', alias: 'targetRecordId' },
      targetKey: { dst: 'guid', alias: 'guid' },
      type: () => OmniRecordEntity,
    },
  })
  @Field(() => OmniRecordType)
  targetRecord!: Relation<OmniRecordType>;

  @ModelField({})
  @Field()
  @IsString()
  @MaxLength(64)
  kind!: string;

  @ModelField({})
  @Field()
  @IsString()
  @IsIn(['active', 'inactive', 'archived'])
  status!: string;

  @ModelField({
    gqlType: returnValue(GraphQLJSONObject),
    gqlOptions: { nullable: true },
  })
  @Field(() => GraphQLJSONObject, { nullable: true })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown> | null;
}

@InputType()
@ModelObject()
export class OmniRelationCreateInput extends OmitType(
  OmniRelationType,
  ['createdAt', 'updatedAt', 'sourceRecord', 'targetRecord'] as const,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: OmniRelationType })
export class OmniRelationCondition extends PartialType(
  OmniRelationCreateInput,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: OmniRelationType })
export class OmniRelationUpdateInput extends PartialType(
  OmniRelationCreateInput,
  InputType,
) {}
