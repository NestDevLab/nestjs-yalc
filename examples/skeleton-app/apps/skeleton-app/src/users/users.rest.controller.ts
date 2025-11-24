import {
  Body,
  Controller,
  Delete,
  Inject,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { crudRestControllerFactory } from '@nestjs-yalc/crud-gen/api-rest/crud-gen-rest.controller.factory';
import { GenericService } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import { getProviderToken } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import {
  SkeletonUser,
  SkeletonUserType,
} from '@nestjs-yalc/skeleton-module/src/skeleton-user.dto';
import { randomUUID } from 'node:crypto';

export const UsersReadonlyController = crudRestControllerFactory<SkeletonUser>({
  entityModel: SkeletonUser,
  dto: SkeletonUserType,
  path: 'users',
  idField: 'guid',
  serviceToken: 'SkeletonUserGenericService',
});

@Controller('users')
export class UsersWriteController {
  constructor(
    @Inject(getProviderToken('SkeletonUserGenericService'))
    readonly service: GenericService<SkeletonUser>,
  ) {}

  @Post()
  async create(
    @Body()
    body: {
      guid?: string;
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    },
  ) {
    const guid = body.guid ?? randomUUID();
    return this.service.createEntity({ ...body, guid } as any);
  }

  @Put(':guid')
  async update(
    @Param('guid') guid: string,
    @Body() body: Partial<SkeletonUser>,
  ) {
    return this.service.updateEntity({ guid } as any, body as any);
  }

  @Delete(':guid')
  async remove(@Param('guid') guid: string) {
    await this.service.deleteEntity({ guid } as any);
    return { deleted: true };
  }
}
