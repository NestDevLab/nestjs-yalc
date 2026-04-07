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
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { OmniNamedEntity } from './base/omni-named.entity.js';

@ObjectType()
@ModelObject()
export class OmniNamedType extends OmniNamedEntity {
  constructor(data?: Partial<OmniNamedType>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  @Field(() => UUIDScalar)
  @IsUUID()
  guid!: string;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  externalId?: string | null;

  @ModelField({})
  @Field()
  @IsString()
  @MaxLength(255)
  title!: string;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string | null;
}

@InputType()
@ModelObject()
export class OmniNamedCreateInput extends OmitType(
  OmniNamedType,
  ['createdAt', 'updatedAt'] as const,
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
