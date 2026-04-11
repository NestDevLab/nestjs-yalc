/* istanbul ignore file */ // this is just an example file, there no need to test it

import { ClassType } from '@nestjs-yalc/types/globals.d.js';
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export enum RoleEnum {
  PUBLIC,
  USER,
  ADMIN,
}

export function RoleAuth(requiredRoles: RoleEnum[]): ClassType<CanActivate> {
  @Injectable()
  class RolesGuard implements CanActivate {
    public roles: RoleEnum[] = [];
    public userId = '';

    canActivate(context: ExecutionContext): boolean {
      const ctx = GqlExecutionContext.create(context);
      const role = ctx.getContext().req.role;

      return (
        !requiredRoles.length ||
        requiredRoles.some(
          (requiredRole) =>
            requiredRole === RoleEnum.PUBLIC || requiredRole === role,
        )
      );
    }
  }

  return RolesGuard;
}
