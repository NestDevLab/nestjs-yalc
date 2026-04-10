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
} from '@nestjs-yalc/crud-gen/object.decorator';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar';
import returnValue from '@nestjs-yalc/utils/returnValue';
import { TaskSyncState } from '@nestjs-yalc/task-system-module/src/task-sync-state.entity';

@ObjectType()
@ModelObject()
export class TaskSyncStateType extends TaskSyncState {
  constructor(data?: Partial<TaskSyncStateType>) {
    super();
    if (data) Object.assign(this, data);
  }

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  guid!: string;

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  @Field(() => UUIDScalar)
  externalRefId!: string;

  @ModelField({})
  @Field()
  status!: string;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  lastSyncedAt?: Date | null;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  lastDirection?: string | null;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  remoteVersion?: string | null;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  localVersionHash?: string | null;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  lastError?: string | null;
}

@InputType()
@ModelObject()
export class TaskSyncStateCreateInput extends OmitType(
  TaskSyncStateType,
  ['createdAt', 'updatedAt'] as const,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: TaskSyncStateType })
export class TaskSyncStateCondition extends PartialType(
  TaskSyncStateCreateInput,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: TaskSyncStateType })
export class TaskSyncStateUpdateInput extends PartialType(
  TaskSyncStateCreateInput,
  InputType,
) {}
