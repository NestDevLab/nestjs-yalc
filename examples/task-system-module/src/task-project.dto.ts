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
import { TaskEventType } from './task-event.dto.js';
import { TaskItemType } from './task-item.dto.js';
import { TaskProject } from './task-project.entity.js';

@ObjectType()
@ModelObject()
export class TaskProjectType extends TaskProject {
  constructor(data?: Partial<TaskProjectType>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  guid: string;

  @ModelField({})
  @Field()
  name: string;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  description?: string | null;

  @ModelField({})
  @Field()
  status: string;

  @Field(() => [TaskItemType], { nullable: true })
  tasks?: TaskItemType[];

  @Field(() => [TaskEventType], { nullable: true })
  events?: TaskEventType[];
}

@InputType()
@ModelObject()
export class TaskProjectCreateInput extends OmitType(
  TaskProjectType,
  ['createdAt', 'updatedAt', 'tasks', 'events'] as const,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: TaskProjectType })
export class TaskProjectCondition extends PartialType(
  TaskProjectCreateInput,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: TaskProjectType })
export class TaskProjectUpdateInput extends PartialType(
  TaskProjectCreateInput,
  InputType,
) {}
