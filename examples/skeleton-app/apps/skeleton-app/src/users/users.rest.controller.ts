import { crudRestControllerFactory } from '@nestjs-yalc/crud-gen/api-rest/crud-gen-rest.controller.factory';
import {
  SkeletonUser,
  SkeletonUserType,
} from '@nestjs-yalc/skeleton-module/src/skeleton-user.dto';
import { CreateUserDto, UpdateUserDto } from './users.dto';

export const UsersController = crudRestControllerFactory<SkeletonUser>({
  entityModel: SkeletonUser,
  dto: SkeletonUserType,
  path: 'users',
  idField: 'guid',
  serviceToken: 'SkeletonUserGenericService',
  mutations: {
    create: {
      decorators: [],
    },
    update: {
      decorators: [],
    },
  },
});
