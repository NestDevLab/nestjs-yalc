import { Module } from '@nestjs/common';
import { EventsController } from './events.rest.controller';
import { taskEventProviders } from './task-event.resolver';

@Module({
  controllers: [EventsController],
  providers: [...taskEventProviders.providers],
})
export class EventsModule {}
