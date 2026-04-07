import { Module } from '@nestjs/common';
import { EventsController } from './events.rest.controller';

@Module({
  controllers: [EventsController],
})
export class EventsModule {}
