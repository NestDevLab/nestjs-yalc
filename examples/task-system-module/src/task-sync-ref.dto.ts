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
import { TaskSyncRef } from './task-sync-ref.entity.js';

@ObjectType()
@ModelObject()
export class TaskSyncRefType extends TaskSyncRef {
  constructor(data?: Partial<TaskSyncRefType>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
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

  @ModelField({})
  @Field()
  syncState: string;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  lastSyncedAt?: Date | null;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  lastError?: string | null;
}

@InputType()
@ModelObject()
export class TaskSyncRefCreateInput extends OmitType(
  TaskSyncRefType,
  ['createdAt', 'updatedAt'] as const,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: TaskSyncRefType })
export class TaskSyncRefCondition extends PartialType(
  TaskSyncRefCreateInput,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: TaskSyncRefType })
export class TaskSyncRefUpdateInput extends PartialType(
  TaskSyncRefCreateInput,
  InputType,
) {}
