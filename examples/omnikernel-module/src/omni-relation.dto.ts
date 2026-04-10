import { InputType, ObjectType, OmitType, PartialType } from '@nestjs/graphql';
import {
  ModelField,
  ModelObject,
} from '@nestjs-yalc/crud-gen/object.decorator';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar';
import returnValue from '@nestjs-yalc/utils/returnValue';
import { IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';
import { GraphQLJSONObject } from 'graphql-type-json';
import type { Relation } from 'typeorm';
import { OmniRecordEntity } from './base/omni-record.entity';
import { OmniRelationEntity } from './base/omni-relation.entity';
import { OmniRecordType } from './omni-record.dto';
import { OmniRelationKind } from './omni-relation-kind.enum';
import { OmniRelationStatus } from './omni-relation-status.enum';

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
  @IsUUID()
  guid!: string;

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  @IsUUID()
  sourceRecordId!: string;

  @ModelField({
    gqlType: () => OmniRecordType,
    gqlOptions: { nullable: false },
    relation: {
      relationType: 'many-to-one',
      sourceKey: { dst: 'sourceRecordId', alias: 'sourceRecordId' },
      targetKey: { dst: 'guid', alias: 'guid' },
      type: () => OmniRecordEntity,
    },
  })
  sourceRecord!: Relation<OmniRecordType>;

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  @IsUUID()
  targetRecordId!: string;

  @ModelField({
    gqlType: () => OmniRecordType,
    gqlOptions: { nullable: false },
    relation: {
      relationType: 'many-to-one',
      sourceKey: { dst: 'targetRecordId', alias: 'targetRecordId' },
      targetKey: { dst: 'guid', alias: 'guid' },
      type: () => OmniRecordEntity,
    },
  })
  targetRecord!: Relation<OmniRecordType>;

  @ModelField({ gqlType: returnValue(OmniRelationKind) })
  @IsEnum(OmniRelationKind)
  kind!: OmniRelationKind;

  @ModelField({ gqlType: returnValue(OmniRelationStatus) })
  @IsEnum(OmniRelationStatus)
  status!: OmniRelationStatus;

  @ModelField({
    gqlType: returnValue(GraphQLJSONObject),
    gqlOptions: { nullable: true },
  })
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
