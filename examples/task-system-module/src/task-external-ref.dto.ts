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
import returnValue from '@nestjs-yalc/utils/returnValue.js';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar.js';
import { TaskExternalRef } from './task-external-ref.entity.js';

@ObjectType()
@ModelObject()
export class TaskExternalRefType extends TaskExternalRef {
  constructor(data?: Partial<TaskExternalRefType>) {
    super();
    if (data) Object.assign(this, data);
  }

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  guid: string;

  @ModelField({})
  @Field()
  internalType: string;

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  @Field(() => UUIDScalar)
  internalId: string;

  @ModelField({})
  @Field()
  provider: string;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  account?: string | null;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  container?: string | null;

  @ModelField({})
  @Field()
  externalId: string;
}

@InputType()
@ModelObject()
export class TaskExternalRefCreateInput extends OmitType(
  TaskExternalRefType,
  ['createdAt', 'updatedAt'] as const,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: TaskExternalRefType })
export class TaskExternalRefCondition extends PartialType(
  TaskExternalRefCreateInput,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: TaskExternalRefType })
export class TaskExternalRefUpdateInput extends PartialType(
  TaskExternalRefCreateInput,
  InputType,
) {}
