import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CreateUserDto } from './users.dto';
import { GenericService } from '@nestjs-yalc/crud-gen/typeorm/generic.service';
import { SkeletonUser } from '@nestjs-yalc/skeleton-module/src/skeleton-user.entity';
import { Inject } from '@nestjs/common';
import { getProviderToken } from '@nestjs-yalc/crud-gen/crud-gen.helpers';
import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

@Controller('users-validation')
export class UsersValidationController {
  constructor(
    @Inject(getProviderToken('SkeletonUserGenericService'))
    private readonly service: GenericService<SkeletonUser>,
  ) {}

  @Post()
  @UsePipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validateCustomDecorators: true,
      exceptionFactory: (errors) => {
        const errorMessages: { [key: string]: any } = {};
        errors.forEach((error) => {
          errorMessages[error.property] = error;
        });
        return new BadRequestException(errorMessages);
      },
    }),
  )
  async create(@Body() body: CreateUserDto) {
    // Let GenericService handle persistence; DTO has already been validated.
    // We generate a guid as done in the main REST controller.
    const guid = randomUUID();
    return this.service.createEntity({ ...body, guid } as any);
  }
}
