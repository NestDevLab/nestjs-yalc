import {
  Field,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar';

export enum TaskAppJoinTypes {
  LEFT_JOIN = 'LEFT_JOIN',
  INNER_JOIN = 'INNER_JOIN',
}

export enum TaskAppSortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}


export enum TaskItemFieldsEnum {
  guid = 'guid',
  title = 'title',
  description = 'description',
  status = 'status',
  projectId = 'projectId',
  dueAt = 'dueAt',
}

registerEnumType(TaskAppJoinTypes, { name: 'TaskAppJoinTypes' });
registerEnumType(TaskAppSortDirection, { name: 'TaskAppSortDirection' });
registerEnumType(TaskItemFieldsEnum, { name: 'TaskItemTypeFieldsEnum' });

@ObjectType('TaskProjectType')
export class TaskProjectType {
  @Field(() => UUIDScalar)
  guid!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string | null;

  @Field()
  status!: string;

  @Field(() => [TaskItemType], { nullable: true })
  tasks?: TaskItemType[];

  @Field(() => [TaskEventType], { nullable: true })
  events?: TaskEventType[];
}

@ObjectType('TaskItemType')
export class TaskItemType {
  @Field(() => UUIDScalar)
  guid!: string;

  @Field()
  title!: string;

  @Field({ nullable: true })
  description?: string | null;

  @Field()
  status!: string;

  @Field(() => UUIDScalar, { nullable: true })
  projectId?: string | null;

  @Field(() => TaskProjectType, { nullable: true })
  project?: TaskProjectType | null;

  @Field({ nullable: true })
  dueAt?: Date | null;
}

@ObjectType('TaskEventType')
export class TaskEventType {
  @Field(() => UUIDScalar)
  guid!: string;

  @Field()
  title!: string;

  @Field({ nullable: true })
  description?: string | null;

  @Field()
  status!: string;

  @Field()
  startAt!: Date;

  @Field({ nullable: true })
  endAt?: Date | null;

  @Field()
  allDay!: boolean;

  @Field(() => UUIDScalar, { nullable: true })
  projectId?: string | null;

  @Field(() => TaskProjectType, { nullable: true })
  project?: TaskProjectType | null;

  @Field({ nullable: true })
  location?: string | null;
}

@ObjectType('TaskSyncStateType')
export class TaskSyncStateType {
  @Field(() => UUIDScalar)
  guid!: string;

  @Field(() => UUIDScalar)
  externalRefId!: string;

  @Field()
  status!: string;

  @Field({ nullable: true })
  lastSyncedAt?: Date | null;

  @Field({ nullable: true })
  lastDirection?: string | null;

  @Field({ nullable: true })
  remoteVersion?: string | null;

  @Field({ nullable: true })
  localVersionHash?: string | null;

  @Field({ nullable: true })
  lastError?: string | null;
}

@ObjectType('CrudGenPageData')
export class CrudGenPageDataType {
  @Field()
  count!: number;

  @Field()
  startRow!: number;

  @Field()
  endRow!: number;
}

function createGridType<T>(name: string, itemType: new () => T) {
  @ObjectType(name)
  class GridType {
    @Field(() => CrudGenPageDataType)
    pageData!: CrudGenPageDataType;

    @Field(() => [itemType])
    nodes!: T[];
  }

  return GridType;
}

export const TaskProjectGridType = createGridType(
  'TaskProjectTypeCrudGenGqlType',
  TaskProjectType,
);
export const TaskItemGridType = createGridType(
  'TaskItemTypeCrudGenGqlType',
  TaskItemType,
);
export const TaskEventGridType = createGridType(
  'TaskEventTypeCrudGenGqlType',
  TaskEventType,
);
export const TaskSyncStateGridType = createGridType(
  'TaskSyncStateTypeCrudGenGqlType',
  TaskSyncStateType,
);

@InputType('TaskProjectCreateInput')
export class TaskProjectCreateInput {
  @Field(() => UUIDScalar)
  guid!: string;
  @Field()
  name!: string;
  @Field({ nullable: true })
  description?: string | null;
  @Field({ nullable: true })
  status?: string;
}

@InputType('TaskProjectCondition')
export class TaskProjectCondition {
  @Field(() => UUIDScalar, { nullable: true })
  guid?: string;
}

@InputType('TaskProjectUpdateInput')
export class TaskProjectUpdateInput {
  @Field({ nullable: true })
  name?: string;
  @Field({ nullable: true })
  description?: string | null;
  @Field({ nullable: true })
  status?: string;
}

@InputType('TaskItemCreateInput')
export class TaskItemCreateInput {
  @Field(() => UUIDScalar)
  guid!: string;
  @Field()
  title!: string;
  @Field({ nullable: true })
  description?: string | null;
  @Field({ nullable: true })
  status?: string;
  @Field(() => UUIDScalar, { nullable: true })
  projectId?: string | null;
  @Field({ nullable: true })
  dueAt?: Date | null;
}

@InputType('TaskItemCondition')
export class TaskItemCondition {
  @Field(() => UUIDScalar, { nullable: true })
  guid?: string;
}

@InputType('TaskItemUpdateInput')
export class TaskItemUpdateInput {
  @Field({ nullable: true })
  title?: string;
  @Field({ nullable: true })
  description?: string | null;
  @Field({ nullable: true })
  status?: string;
  @Field(() => UUIDScalar, { nullable: true })
  projectId?: string | null;
  @Field({ nullable: true })
  dueAt?: Date | null;
}

@InputType('TaskEventCreateInput')
export class TaskEventCreateInput {
  @Field(() => UUIDScalar)
  guid!: string;
  @Field()
  title!: string;
  @Field({ nullable: true })
  description?: string | null;
  @Field({ nullable: true })
  status?: string;
  @Field()
  startAt!: Date;
  @Field({ nullable: true })
  endAt?: Date | null;
  @Field({ nullable: true })
  allDay?: boolean;
  @Field(() => UUIDScalar, { nullable: true })
  projectId?: string | null;
  @Field({ nullable: true })
  location?: string | null;
}

@InputType('TaskEventCondition')
export class TaskEventCondition {
  @Field(() => UUIDScalar, { nullable: true })
  guid?: string;
}

@InputType('TaskEventUpdateInput')
export class TaskEventUpdateInput {
  @Field({ nullable: true })
  title?: string;
  @Field({ nullable: true })
  description?: string | null;
  @Field({ nullable: true })
  status?: string;
  @Field({ nullable: true })
  startAt?: Date;
  @Field({ nullable: true })
  endAt?: Date | null;
  @Field({ nullable: true })
  allDay?: boolean;
  @Field(() => UUIDScalar, { nullable: true })
  projectId?: string | null;
  @Field({ nullable: true })
  location?: string | null;
}

@InputType('TaskSyncStateCreateInput')
export class TaskSyncStateCreateInput {
  @Field(() => UUIDScalar)
  guid!: string;
  @Field(() => UUIDScalar)
  externalRefId!: string;
  @Field({ nullable: true })
  status?: string;
  @Field({ nullable: true })
  lastSyncedAt?: Date | null;
  @Field({ nullable: true })
  lastDirection?: string | null;
  @Field({ nullable: true })
  remoteVersion?: string | null;
  @Field({ nullable: true })
  localVersionHash?: string | null;
  @Field({ nullable: true })
  lastError?: string | null;
}

@InputType('TaskSyncStateCondition')
export class TaskSyncStateCondition {
  @Field(() => UUIDScalar, { nullable: true })
  guid?: string;
}

@InputType('TaskSyncStateUpdateInput')
export class TaskSyncStateUpdateInput {
  @Field(() => UUIDScalar, { nullable: true })
  externalRefId?: string;
  @Field({ nullable: true })
  status?: string;
  @Field({ nullable: true })
  lastSyncedAt?: Date | null;
  @Field({ nullable: true })
  lastDirection?: string | null;
  @Field({ nullable: true })
  remoteVersion?: string | null;
  @Field({ nullable: true })
  localVersionHash?: string | null;
  @Field({ nullable: true })
  lastError?: string | null;
}

@InputType('TaskItemSortModel')
export class TaskItemSortModel {
  @Field(() => TaskItemFieldsEnum)
  colId!: TaskItemFieldsEnum;

  @Field(() => TaskAppSortDirection, { nullable: true })
  sort?: TaskAppSortDirection;
}

@InputType('TaskItemTypeFilterTextInput')
export class TaskItemTypeFilterTextInput {
  @Field(() => String, { nullable: true })
  filterType?: string;
  @Field(() => String, { nullable: true })
  type?: string;
  @Field(() => String, { nullable: true })
  field?: string;
  @Field(() => String, { nullable: true })
  filter?: string;
}

@InputType('TaskItemTypeFilterInput')
export class TaskItemTypeFilterInput {
  @Field(() => TaskItemTypeFilterTextInput, { nullable: true, name: 'text' })
  text?: TaskItemTypeFilterTextInput;
}

@InputType('TaskItemTypeFilterExpressionInput')
export class TaskItemTypeFilterExpressionInput {
  @Field(() => String, { nullable: true })
  operator?: string;

  @Field(() => [TaskItemTypeFilterInput], { nullable: true })
  expressions?: TaskItemTypeFilterInput[];

  @Field(() => [TaskItemTypeFilterExpressionInput], { nullable: true })
  childExpressions?: TaskItemTypeFilterExpressionInput[];
}

@InputType('TaskProjectJoinInputType')
export class TaskProjectJoinInputType {
  @Field(() => TaskAppJoinTypes, { nullable: true })
  joinType?: TaskAppJoinTypes;
}

@InputType('TaskItemTypeJoinOptionsInputType')
export class TaskItemTypeJoinOptionsInputType {
  @Field(() => TaskProjectJoinInputType, { nullable: true })
  project?: TaskProjectJoinInputType;
}
