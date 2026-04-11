import { createMock } from '@golevelup/ts-jest';
import { describe, expect, it, jest } from '@jest/globals';
import { createNestJsGraphqlMock } from '@nestjs-yalc/jest/graphql.helper.js';
import { CanActivate, ExecutionContext } from '@nestjs/common';

const mockedGraphql = await createNestJsGraphqlMock(import.meta);
const mockedExecutionContext =
  createMock<typeof mockedGraphql.GqlExecutionContext>();
mockedGraphql.GqlExecutionContext = mockedExecutionContext;
jest.unstable_mockModule('@nestjs/graphql', () => mockedGraphql);

const { RoleEnum } = await import('../role.guard.js');
const roleGuard = await import('../role.guard.js');

describe('test role.guard', () => {
  it('should create the RoleGuard class', () => {
    const RoleGuardClass = roleGuard.RoleAuth([]);
    expect(RoleGuardClass).toBeDefined();
    expect(new RoleGuardClass()).toBeDefined();
  });

  it('should call canActivateMethod without Roles', () => {
    const RoleGuardClass = roleGuard.RoleAuth([]);
    const roleGuardInstance: CanActivate = new RoleGuardClass();

    const mockedContext = createMock<ExecutionContext>();

    expect(roleGuardInstance.canActivate(mockedContext)).toBeDefined();
  });

  it('should call canActivateMethod with Roles', () => {
    const RoleGuardClass = roleGuard.RoleAuth([RoleEnum.ADMIN]);
    const roleGuardInstance: CanActivate = new RoleGuardClass();

    const mockedContext = createMock<ExecutionContext>();

    expect(roleGuardInstance.canActivate(mockedContext)).toBeDefined();
  });
});
