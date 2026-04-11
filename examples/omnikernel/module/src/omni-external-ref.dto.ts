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
import { OmniExternalRefEntity } from './base/omni-external-ref.entity';
import { OmniExternalRefInternalType } from './omni-external-ref-internal-type.enum';

@ObjectType()
@ModelObject()
export class OmniExternalRefType extends OmniExternalRefEntity {
  constructor(data?: Partial<OmniExternalRefType>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  @IsUUID()
  guid!: string;

  @ModelField({ gqlType: returnValue(OmniExternalRefInternalType) })
  @IsEnum(OmniExternalRefInternalType)
  internalType!: OmniExternalRefInternalType;

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  @IsUUID()
  internalId!: string;

  @ModelField({ gqlType: returnValue(String) })
  @IsString()
  @MaxLength(128)
  provider!: string;

  @ModelField({
    gqlType: returnValue(String),
    gqlOptions: { nullable: true },
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  account?: string | null;

  @ModelField({
    gqlType: returnValue(String),
    gqlOptions: { nullable: true },
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  container?: string | null;

  @ModelField({ gqlType: returnValue(String) })
  @IsString()
  @MaxLength(255)
  externalId!: string;

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
export class OmniExternalRefCreateInput extends OmitType(
  OmniExternalRefType,
  ['createdAt', 'updatedAt'] as const,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: OmniExternalRefType })
export class OmniExternalRefCondition extends PartialType(
  OmniExternalRefCreateInput,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: OmniExternalRefType })
export class OmniExternalRefUpdateInput extends PartialType(
  OmniExternalRefCreateInput,
  InputType,
) {}
