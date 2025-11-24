import {
  Field,
  HideField,
  InputType,
  ObjectType,
  OmitType,
  PartialType,
} from '@nestjs/graphql';
import {
  ModelField,
  ModelObject,
} from '@nestjs-yalc/crud-gen/object.decorator.js';
import { SkeletonUser } from './skeleton-user.entity.js';
import returnValue from '@nestjs-yalc/utils/returnValue.js';
import { UUIDScalar } from '@nestjs-yalc/graphql/scalars/uuid.scalar.js';
import { SkeletonPhoneType } from './skeleton-phone.dto.js';

@ObjectType()
@ModelObject()
export class SkeletonUserType extends SkeletonUser {
  constructor(data?: Partial<SkeletonUserType>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }

  @ModelField({
    gqlOptions: {
      description: 'The user first name',
    },
  })
  firstName: string;

  @ModelField({
    gqlOptions: {
      description: 'The user last name',
    },
  })
  lastName: string;

  @ModelField({
    gqlOptions: {
      description: 'The user email address',
    },
  })
  email: string;

  @ModelField<SkeletonPhoneType>({
    relation: {
      type: () => SkeletonPhoneType,
      relationType: 'one-to-many',
      sourceKey: { dst: 'guid', alias: 'guid' },
      targetKey: { dst: 'userId', alias: 'userId' },
    },
  })
  SkeletonPhone?: SkeletonPhoneType[];

  @HideField()
  password: string;

  // guid should be always required in SQL queries to make sure that the relation
  // is always resolved, and it should be exposed as a UUID Scalar to GraphQL
  @ModelField({
    gqlType: returnValue(UUIDScalar),
    gqlOptions: {
      description: 'The user ID generated with UUID',
    },
    isRequired: true,
  })
  guid: string;

  @ModelField({
    gqlOptions: {
      description: "It's the combination of firstName and lastName",
    },
    denyFilter: true,
  })
  fullName: string;
}

/**
 * Here all the input type for Graphql
 */
@InputType()
@ModelObject()
export class SkeletonUserCreateInput extends OmitType(
  SkeletonUserType,
  ['SkeletonPhone', 'fullName', 'createdAt', 'updatedAt'] as const,
  InputType,
) {
  @Field()
  password: string;
}

@InputType()
@ModelObject({ copyFrom: SkeletonUserType })
export class SkeletonUserCondition extends PartialType(
  SkeletonUserCreateInput,
  InputType,
) {}

@InputType()
@ModelObject({ copyFrom: SkeletonUserType })
export class SkeletonUserUpdateInput extends PartialType(
  SkeletonUserCreateInput,
  InputType,
) {}
