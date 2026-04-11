import { Module } from '@nestjs/common';
import { EventsController, taskEventProviders } from './task-event.resource';

@Module({
  controllers: [EventsController],
  providers: [...taskEventProviders],
})
export class EventsModule {}
