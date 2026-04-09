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
import { TaskEvent } from '@nestjs-yalc/task-system-module/src/task-event.entity';

@ObjectType()
@ModelObject()
export class TaskEventType extends TaskEvent {
  constructor(data?: Partial<TaskEventType>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  @Field(() => UUIDScalar)
  guid!: string;

  @ModelField({})
  @Field()
  title!: string;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  description?: string | null;

  @ModelField({})
  @Field()
  status!: string;

  @ModelField({})
  @Field()
  startAt!: Date;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  endAt?: Date | null;

  @ModelField({})
  @Field()
  allDay!: boolean;

  @ModelField({
    gqlType: returnValue(UUIDScalar),
    gqlOptions: { nullable: true },
  })
  @Field(() => UUIDScalar, { nullable: true })
  projectId?: string | null;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  location?: string | null;
}

@InputType()
@ModelObject()
export class TaskEventCreateInput extends OmitType(
  TaskEventType,
  ['createdAt', 'updatedAt'] as const,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: TaskEventType })
export class TaskEventCondition extends PartialType(
  TaskEventCreateInput,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: TaskEventType })
export class TaskEventUpdateInput extends PartialType(
  TaskEventCreateInput,
  InputType,
) {}
