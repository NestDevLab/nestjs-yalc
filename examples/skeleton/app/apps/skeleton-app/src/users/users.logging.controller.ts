import { Controller, Get } from '@nestjs/common';
import { YalcEventService } from '@nestjs-yalc/event-manager';

@Controller('users-logging')
export class UsersLoggingController {
  constructor(private readonly events: YalcEventService) {}

  @Get()
  async logExample() {
    await this.events.log(['skeleton', 'users', 'logging-demo'], {
      message: 'Users logging endpoint called',
      data: { feature: 'skeleton-app', endpoint: 'users-logging' },
      event: { await: true },
    });

    return { ok: true };
  }
}
