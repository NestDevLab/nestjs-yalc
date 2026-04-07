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
import { TaskItem } from './task-item.entity.js';
import { TaskProjectType } from './task-project.dto.js';
import { TaskProject } from './task-project.entity.js';

@ObjectType()
@ModelObject()
export class TaskItemType extends TaskItem {
  constructor(data?: Partial<TaskItemType>) {
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
  dueAt?: Date | null;
}

@InputType()
@ModelObject()
export class TaskItemCreateInput extends OmitType(
  TaskItemType,
  ['createdAt', 'updatedAt', 'project'] as const,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: TaskItemType })
export class TaskItemCondition extends PartialType(
  TaskItemCreateInput,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: TaskItemType })
export class TaskItemUpdateInput extends PartialType(
  TaskItemCreateInput,
  InputType,
) {}
