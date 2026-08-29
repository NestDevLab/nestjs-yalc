import {
  InputType,
  Int,
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
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { OmniNamedEntity } from './base/omni-named.entity.js';
import { assignOmniPublicDto } from './omni-dto.helpers.js';

@ObjectType()
@ModelObject()
export class OmniNamedType extends OmniNamedEntity {
  constructor(data?: Partial<OmniNamedType>) {
    super();
    if (data) {
      assignOmniPublicDto(this, data);
    }
  }

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  @IsUUID()
  guid!: string;

  @ModelField({ gqlType: returnValue(Int) })
  @IsInt()
  revision!: number;

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
}

@InputType()
@ModelObject()
export class OmniNamedCreateInput extends OmitType(
  OmniNamedType,
  ['createdAt', 'updatedAt', 'revision'] as const,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: OmniNamedType })
export class OmniNamedCondition extends PartialType(
  OmniNamedCreateInput,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: OmniNamedType })
export class OmniNamedUpdateInput extends PartialType(
  OmniNamedCreateInput,
  InputType,
) {}
