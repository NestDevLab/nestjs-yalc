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
import { TaskEvent } from './task-event.entity.js';
import { TaskProjectType } from './task-project.dto.js';
import { TaskProject } from './task-project.entity.js';

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
  guid: string;

  @ModelField({})
  @Field()
  title: string;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  description?: string | null;

  @ModelField({})
  @Field()
  status: string;

  @ModelField({})
  @Field()
  startAt: Date;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  endAt?: Date | null;

  @ModelField({})
  @Field()
  allDay: boolean;

  @ModelField({
    gqlType: returnValue(UUIDScalar),
    gqlOptions: { nullable: true },
  })
  @Field(() => UUIDScalar, { nullable: true })
  projectId?: string | null;

  @ModelField({
    gqlType: returnValue(TaskProjectType),
    gqlOptions: { nullable: true },
    relation: {
      relationType: 'many-to-one',
      sourceKey: { dst: 'projectId', alias: 'projectId' },
      targetKey: { dst: 'guid', alias: 'guid' },
      type: () => TaskProject,
    },
  })
  @Field(() => TaskProjectType, { nullable: true })
  project?: TaskProjectType | null;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  location?: string | null;
}

@InputType()
@ModelObject()
export class TaskEventCreateInput extends OmitType(
  TaskEventType,
  ['createdAt', 'updatedAt', 'project'] as const,
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
