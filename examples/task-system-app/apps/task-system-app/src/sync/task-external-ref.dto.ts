import { Field, InputType, ObjectType, PartialType } from '@nestjs/graphql';
import {
  ModelField,
  ModelObject,
} from '@nestjs-yalc/crud-gen/object.decorator';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar';
import { TaskExternalRef } from '../../../../../task-system-module/src/task-external-ref.entity';
import returnValue from '@nestjs-yalc/utils/returnValue';

function mapTaskExternalRefInternalTypeToOmni(value?: string | null): string {
  switch (value) {
    case 'collection':
    case 'project':
      return 'collection';
    case 'document':
      return 'document';
    case 'record':
    case 'task':
    case 'event':
    case 'sync-state':
    case undefined:
    case null:
    default:
      return 'record';
  }
}

function mapOmniExternalRefInternalTypeToTask(value?: string | null): string {
  switch (value) {
    case 'collection':
      return 'project';
    case 'document':
      return 'document';
    case 'record':
    default:
      return 'task';
  }
}

@ObjectType()
@ModelObject()
export class TaskExternalRefType extends TaskExternalRef {
  constructor(data?: Partial<TaskExternalRefType>) {
    super();
    if (data) Object.assign(this, data);
  }

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  @Field(() => UUIDScalar)
  guid!: string;

  @ModelField({
    dst: {
      name: 'internalType',
      transformerDst: (_dst, value) => mapTaskExternalRefInternalTypeToOmni(value),
      transformerSrc: (_src, value) => mapOmniExternalRefInternalTypeToTask(value),
    },
  })
  @Field()
  internalType!: string;

  @ModelField({ gqlType: returnValue(UUIDScalar), isRequired: true })
  @Field(() => UUIDScalar)
  internalId!: string;

  @ModelField({})
  @Field()
  provider!: string;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  account?: string | null;

  @ModelField({ gqlOptions: { nullable: true } })
  @Field({ nullable: true })
  container?: string | null;

  @ModelField({})
  @Field()
  externalId!: string;
}

@InputType()
@ModelObject({ copyFrom: TaskExternalRefType })
export class TaskExternalRefCreateInput {
  @Field(() => UUIDScalar)
  guid!: string;

  @Field()
  internalType!: string;

  @Field(() => UUIDScalar)
  internalId!: string;

  @Field()
  provider!: string;

  @Field({ nullable: true })
  account?: string | null;

  @Field({ nullable: true })
  container?: string | null;

  @Field()
  externalId!: string;
}

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
