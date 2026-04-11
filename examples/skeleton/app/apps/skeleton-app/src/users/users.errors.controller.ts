import { Controller, Get } from '@nestjs/common';
import { YalcEventService } from '@nestjs-yalc/event-manager';

@Controller('users/errors')
export class UsersErrorsController {
  constructor(private readonly events: YalcEventService) {}

  @Get('bad-request')
  badRequest() {
    throw this.events.errorBadRequest('users.bad-request', {
      response: {
        message: 'Bad request demo',
      },
      data: {
        reason: 'DEMO_BAD_REQUEST',
      },
    });
  }

  @Get('not-found')
  notFound() {
    throw this.events.errorNotFound('users.not-found', {
      response: {
        message: 'User not found demo',
      },
      data: {
        reason: 'DEMO_NOT_FOUND',
      },
    });
  }
}
