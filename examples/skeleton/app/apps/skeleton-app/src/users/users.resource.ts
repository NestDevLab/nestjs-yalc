import { UseGuards } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { CrudGenResourceFactory } from '@nestjs-yalc/crud-gen';
import { InputArgs } from '@nestjs-yalc/crud-gen/api-graphql/gqlmapper.decorator.js';
import {
  ExtraArgsStrategy,
  FilterType,
  GeneralFilters,
} from '@nestjs-yalc/crud-gen/crud-gen.enum.js';
import returnValue from '@nestjs-yalc/utils/returnValue.js';
import {
  RoleAuth,
  RoleEnum,
  SkeletonUser,
  SkeletonUserCondition,
  SkeletonUserCreateInput,
  skeletonUserServiceFactory,
  SkeletonUserType,
  SkeletonUserUpdateInput,
} from '@nestjs-yalc/skeleton-module';
import { bindGeneratedDataloaderEventEmitter } from '../crudgen-provider-compat.js';

const skeletonUserServiceToken = 'SkeletonUserGenericService';

const lowerCaseEmailMiddleware = (
  _ctx: GqlExecutionContext,
  input: SkeletonUserType,
  value: boolean,
) => {
  if (value === true) {
    input.email = input.email.toLowerCase();
  }
};

export const usersResource = CrudGenResourceFactory<SkeletonUser>({
  entityModel: SkeletonUser,
  backend: {
    service: {
      dbConnection: 'default',
      entityModel: SkeletonUser,
      provider: {
        provide: skeletonUserServiceToken,
        useClass: skeletonUserServiceFactory('default'),
      },
    },
    dataloader: { databaseKey: 'guid' },
  },
  graphql: {
    resolver: {
      dto: SkeletonUserType,
      input: {
        create: SkeletonUserCreateInput,
        update: SkeletonUserUpdateInput,
        conditions: SkeletonUserCondition,
      },
      prefix: 'SkeletonModule_',
      queries: {
        getResource: {
          decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
          idName: 'guid',
          queryParams: {
            description: 'Get a specific user',
          },
        },
        getResourceGrid: {
          decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
          extraArgs: {
            firstName: {
              filterCondition: GeneralFilters.CONTAINS,
              filterType: FilterType.TEXT,
              options: {
                type: returnValue(String),
                nullable: true,
              },
            },
            lastName: {
              filterCondition: GeneralFilters.CONTAINS,
              filterType: FilterType.TEXT,
              options: {
                type: returnValue(String),
                nullable: true,
              },
            },
          },
          extraArgsStrategy: ExtraArgsStrategy.AT_LEAST_ONE,
          queryParams: {
            description: 'Get a list of users',
          },
        },
      },
      mutations: {
        createResource: {
          decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
          extraInputs: {
            lowerCaseEmail: {
              gqlOptions: {
                description: 'Force the email to be in lowercase',
                type: returnValue(Boolean),
                defaultValue: true,
                nullable: true,
              },
              middleware: lowerCaseEmailMiddleware,
            },
          },
          queryParams: {
            description: 'Create a new user',
          },
        },
        updateResource: {
          decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
          queryParams: {
            description: 'Update an existing user',
          },
        },
        deleteResource: {
          decorators: [UseGuards(RoleAuth([RoleEnum.PUBLIC]))],
          queryParams: {
            description: 'Delete an existing user',
          },
        },
      },
    },
  },
  rest: {
    dto: SkeletonUserType,
    path: 'users',
    idField: 'guid',
    serviceToken: skeletonUserServiceToken,
    mutations: {
      create: { decorators: [] },
      update: { decorators: [] },
    },
  },
});

export const UsersController = usersResource.controllers[0];
export const usersResourceProviders = bindGeneratedDataloaderEventEmitter(
  usersResource.providers,
);
