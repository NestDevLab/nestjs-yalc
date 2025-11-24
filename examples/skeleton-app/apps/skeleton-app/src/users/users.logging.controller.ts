import { Controller, Get, Inject } from '@nestjs/common';
import { ImprovedLoggerService } from '@nestjs-yalc/logger';
import { EVENT_LOGGER } from '@nestjs-yalc/event-manager';

@Controller('users-logging')
export class UsersLoggingController {
  constructor(
    @Inject(EVENT_LOGGER)
    private readonly logger: ImprovedLoggerService,
  ) {}

  @Get()
  logExample() {
    this.logger.log('Users logging endpoint called', {
      data: { feature: 'skeleton-app', endpoint: 'users-logging' },
    });

    return { ok: true };
  }
}
